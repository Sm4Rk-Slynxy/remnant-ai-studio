#!/usr/bin/env python3
"""Local static studio with FFmpeg finishing. No model downloads or paid services."""
import argparse
import functools
import http.server
import json
import ipaddress
import math
import os
from pathlib import Path
import re
import secrets
import signal
import shutil
import subprocess
import tempfile
import threading
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit, unquote
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent
PUBLIC_ASSETS = frozenset(['character-core.js', 'character-director.js', 'character-studio.js', 'character-workflow.js', 'clip-quality.js', 'easy-studio-core.js', 'easy-studio.js', 'h3-prompts.js', 'image-core.js', 'image-gallery.js', 'image-library.js', 'image-studio.js', 'index.html', 'local-ai.js', 'music-core.js', 'music-studio.js', 'photoshoot-core.js', 'photoshoot-studio.js', 'render-quality.js', 'script.js', 'sequence-core.js', 'sequence-studio.js', 'studio-core.js', 'studio.css', 'studio.js', 'style.css', 'video-join-core.js', 'video-joiner.js', 'workflow-presets.js'])
LOCAL_WORKFLOWS = frozenset(['micw-all-in-one-character-api.json', 'photoshoot-series-api.json', 'photoshoot-series-source.json', 'photoshoot-options.json', 'krea2-pro-grade-source.json'])
TOKEN_RE = re.compile(r'^[a-f0-9]{32}$')
# Untrusted uploaded files must not select playlist/network demuxers.
MEDIA_FORMATS = 'mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,flv,mpeg,mpegts,mp3,wav,flac,ogg,aac,gif,png_pipe,jpeg_pipe,webp_pipe'
MEDIA_OPTIONS = ['-protocol_whitelist', 'file,pipe', '-format_whitelist', MEDIA_FORMATS]

def safe_input(path):
    return [*MEDIA_OPTIONS, '-i', str(path)]


DIMENSIONS = {'16:9': (1344, 768), '9:16': (768, 1344), '1:1': (768, 768), '4:3': (1024, 768), '21:9': (1344, 576)}


def comfy_origin(value):
    if not isinstance(value, str):
        raise ValueError('Enter the ComfyUI server address.')
    value = value.strip().rstrip('/')
    url = urlsplit(value)
    if (url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or
            url.query or url.fragment or url.path or any(c.isspace() for c in value) or
            (url.port is not None and not 1 <= url.port <= 65535)):
        raise ValueError('Use an HTTP(S) server address including its port, without a path or credentials.')
    host = url.hostname.encode('idna').decode().lower()
    if ':' in host:
        ipaddress.IPv6Address(host)
        host = '[' + host + ']'
    elif not re.fullmatch(r'[a-z0-9.-]+', host):
        raise ValueError('Use a valid ComfyUI IP address or hostname.')
    if url.port is not None and (url.scheme, url.port) not in (('http', 80), ('https', 443)):
        host += ':' + str(url.port)
    return url.scheme + '://' + host


def saved_comfy_origin(path, fallback):
    if path.is_file():
        return comfy_origin(json.loads(path.read_text())['comfyEndpoint'])
    return comfy_origin(fallback) if fallback else ''


def save_comfy_origin(server, value):
    endpoint = comfy_origin(value)
    path = getattr(server, 'settings_file', None)
    if path is None:
        raise ValueError('This server has no writable connection settings configured.')
    with server.settings_lock:
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.comfy-', delete=False) as stream:
                temporary = Path(stream.name)
                json.dump({'comfyEndpoint': endpoint}, stream)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
            server.comfy_url = endpoint
        finally:
            if temporary:
                temporary.unlink(missing_ok=True)
    return endpoint


def ai_target(endpoint, route):
    if not isinstance(endpoint, str):
        raise ValueError('Provide the AI server address.')
    url = urlsplit(endpoint)
    if url.scheme not in ['http', 'https'] or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError('Use a local or LAN AI server address without credentials or query parameters.')
    if url.hostname != 'localhost':
        try:
            address = ipaddress.ip_address(url.hostname)
        except ValueError:
            raise ValueError('Use localhost or the AI computer’s LAN IP address.')
        networks = [ipaddress.ip_network(n) for n in ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '::1/128', 'fc00::/7']]
        if not any(address in n for n in networks if n.version == address.version):
            raise ValueError('The AI relay supports this computer and private LAN addresses.')
    if route not in ['models', 'chat/completions'] or not re.fullmatch(r'(?:/[a-zA-Z0-9_-]+)*', url.path.rstrip('/')):
        raise ValueError('Unsupported AI API route.')
    return endpoint.rstrip('/') + '/' + route


class NoAIRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def media_path(folder, token):
    if not isinstance(token, str) or not TOKEN_RE.fullmatch(token):
        raise ValueError('Invalid media identifier.')
    path = folder / token
    if not path.is_file():
        raise ValueError('Media is missing from the finishing server. Render / upload again.')
    return path


def ai_timeout_seconds(value=1800):
    if type(value) is not int or not 60 <= value <= 7200:
        raise ValueError('Choose an AI request timeout between 1 and 120 minutes.')
    return value


def finishing_dimensions(request):
    scale = request.get('outputScale', 1)
    if type(scale) not in (int, float) or scale not in (1, 1.5, 2, 4):
        raise ValueError('Choose 1x, 1.5x, 2x or 4x output scale.')
    width, height = DIMENSIONS[request['aspect']]
    width, height = round(width * scale), round(height * scale)
    if width * height > 16000000:
        raise ValueError('Finished video exceeds 16 megapixels. Choose a smaller scale.')
    return width, height


def probe_video(folder, request):
    source = media_path(folder, request.get('id'))
    proc = subprocess.run(['ffprobe', *MEDIA_OPTIONS, '-v', 'error', '-show_entries', 'stream=codec_type,width,height,duration:format=duration', '-of', 'json', str(source)], capture_output=True, timeout=30)
    if proc.returncode:
        raise ValueError('This file is not a readable video.')
    info = json.loads(proc.stdout)
    video = next((x for x in info.get('streams', []) if x.get('codec_type') == 'video'), None)
    if not video:
        raise ValueError('This file has no video stream.')
    seconds = float(video.get('duration') or info.get('format', {}).get('duration') or 0)
    if not math.isfinite(seconds) or not 1/24 <= seconds <= 3600:
        raise ValueError('Upload videos between one frame and 60 minutes long.')
    return {'duration': seconds, 'width': int(video['width']), 'height': int(video['height']), 'hasAudio': any(x.get('codec_type') == 'audio' for x in info.get('streams', []))}


def join_dimensions(request):
    width, height = request.get('outputWidth'), request.get('outputHeight')
    if (type(width) is not int or type(height) is not int or not 32 <= width <= 8192 or not 32 <= height <= 8192 or width % 2 or height % 2 or width*height > 16000000):
        raise ValueError('Choose even output dimensions between 32 and 8192 pixels, within 16 megapixels.')
    return width, height


def assemble(folder, request):
    """Normalize sequentially to bound RAM and mux the untouched song as a single bed."""
    joining = request.get('mode') == 'join'
    if request.get('mode') not in (None, 'join'):
        raise ValueError('Unsupported assembly mode.')
    if request.get('fps') != 24 or (not joining and request.get('aspect') not in DIMENSIONS):
        raise ValueError('Choose a supported aspect ratio and 24 fps.')
    song = media_path(folder, request['songId']) if request.get('songId') is not None else None
    keep_audio = song is None and not (joining and request.get('audio') == 'mute')
    if joining and request.get('audio', 'keep') not in ('keep', 'mute'):
        raise ValueError('Choose whether to keep or mute clip audio.')
    clips = request.get('clips')
    if not isinstance(clips, list) or not 1 <= len(clips) <= 250:
        raise ValueError('Provide 1–250 rendered clips.')
    total = 0
    for clip in clips:
        if not isinstance(clip, dict) or type(clip.get('frames')) is not int or not (1 if joining else (120 if song else 96)) <= clip['frames'] <= (86400 if joining else (336 if song else 360)):
            raise ValueError('Each shot must cover 4–15 seconds (5–14 with a song) at 24 fps.')
        media_path(folder, clip.get('id'))
        total += clip['frames']
    if total > (3600 if joining else 1200) * 24 + 1:
        raise ValueError('Maximum combined duration is 60 minutes for uploaded videos or 20 minutes for generated films.')
    width, height = join_dimensions(request) if joining else finishing_dimensions(request)
    result_id = secrets.token_hex(16)
    target = folder / result_id
    def run(args):
        proc = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', *args], capture_output=True, timeout=1800)
        if proc.returncode:
            raise ValueError('FFmpeg could not finish the video: ' + proc.stderr.decode(errors='replace')[-1200:])
    try:
        with tempfile.TemporaryDirectory(prefix='music-edit-', dir=folder) as work:
            work = Path(work)
            for index, clip in enumerate(clips):
                source = media_path(folder, clip['id'])
                # Never freeze-pad short outputs: missing generated footage is a real error.
                probe = subprocess.run(['ffprobe', *MEDIA_OPTIONS, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration:format=duration', '-of', 'json', str(source)], capture_output=True, timeout=30)
                if probe.returncode:
                    raise ValueError(f'Shot {index + 1} is not a readable video.')
                info = json.loads(probe.stdout)
                if not info.get('streams'):
                    raise ValueError(f'Shot {index + 1} has no video stream.')
                seconds = float(info['streams'][0].get('duration') or info.get('format', {}).get('duration') or 0)
                skip = clip.get('startFrame', 0) if joining else clip.get('skipFrames', 0)
                if type(skip) is not int or (not 0 <= skip <= 86400 if joining else skip not in [0, 22]):
                    raise ValueError('Unsupported continuation overlap.')
                if not math.isfinite(seconds) or seconds + .06 < (clip['frames'] + skip) / 24:
                    raise ValueError(f'Shot {index + 1} is shorter than its approved edit duration. Check the workflow length mapping.')
                filters = f'fps=24,scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,trim=start_frame={skip}:end_frame={clip["frames"]+skip},setpts=N/(24*TB)'
                audio_args = ['-an']
                extra_inputs = []
                if keep_audio:
                    audio_probe = subprocess.run(['ffprobe', *MEDIA_OPTIONS, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'json', str(source)], capture_output=True, timeout=30)
                    has_audio = audio_probe.returncode == 0 and bool(json.loads(audio_probe.stdout).get('streams'))
                    if not has_audio:
                        extra_inputs = ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
                    audio_filter = (f'atrim=start={skip/24}:end={(skip+clip["frames"])/24},asetpts=PTS-STARTPTS,' if has_audio else '') + f'aresample=48000,apad,atrim=duration={clip["frames"]/24}'
                    audio_args = ['-map', '0:a:0' if has_audio else '1:a:0', '-af', audio_filter, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2']
                run([*safe_input(source), *extra_inputs, '-map', '0:v:0', *audio_args, '-vf', filters, '-frames:v', str(clip['frames']), '-t', str(clip['frames']/24), '-r', '24', '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '2', str(work / f'{index}.mp4')])
            listing = work / 'list.txt'
            listing.write_text(''.join(f"file '{i}.mp4'\n" for i in range(len(clips))))
            # Video frames cover ceil(song duration*24). Master is not stretched, looped or regenerated.
            if song is not None:
                run(['-f', 'concat', '-safe', '1', '-i', str(listing), *safe_input(song), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-t', str(total / 24), '-movflags', '+faststart', '-f', 'mp4', str(target)])
            else:
                run(['-f', 'concat', '-safe', '1', '-i', str(listing), '-map', '0:v:0', *(['-map', '0:a:0'] if keep_audio else ['-an']), '-c', 'copy', '-t', str(total / 24), '-movflags', '+faststart', '-f', 'mp4', str(target)])
        return result_id
    except Exception:
        target.unlink(missing_ok=True)
        raise


def extract_frame(folder, request):
    """Extract the last frame of the approved edit, excluding H3's extra tail."""
    source = media_path(folder, request.get('id'))
    frames, skip = request.get('frames'), request.get('skipFrames', 0)
    if type(frames) is not int or not 96 <= frames <= 360 or type(skip) is not int or skip not in (0, 22):
        raise ValueError('Invalid clip timing for last-frame extraction.')
    token = secrets.token_hex(16)
    target = folder / token
    try:
        proc = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-t', str((frames+skip)/24+.1), *safe_input(source), '-an', '-vf', f'fps=24,select=eq(n\\,{skip+frames-1})', '-frames:v', '1', '-update', '1', '-f', 'image2', '-c:v', 'png', '-threads', '1', str(target)], capture_output=True, timeout=120)
        if proc.returncode or not target.is_file() or target.stat().st_size == 0:
            raise ValueError('The clip has no frame at its approved ending. Check its duration.')
        return token
    except Exception:
        target.unlink(missing_ok=True)
        raise


class StudioHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http: https:; media-src 'self' data: blob: http: https:; connect-src 'self' http: https: data: blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
        # Local source changes must not leave older helpers mixed with newer UI code.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def json_response(self, code, value):
        body = json.dumps(value).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def allowed_host(self):
        host = self.headers.get('Host', '')
        return host in {f'127.0.0.1:{self.server.server_port}', f'localhost:{self.server.server_port}'}

    def allowed_read(self):
        # Host validation prevents DNS rebinding; Fetch Metadata rejects cross-site
        # embedding of local tokens and private media, including requests without Origin.
        return self.allowed_host() and self.headers.get('Sec-Fetch-Site') not in ('cross-site', 'same-site')

    def public_file(self):
        path = unquote(urlsplit(self.path).path)
        if path == '/':
            path = '/index.html'
        relative = path.lstrip('/')
        allowed = relative in PUBLIC_ASSETS or relative in {
            'prompts/h3-full-reference-system.txt', 'workflows/h3-scene-first-last-api.json',
            'workflows/krea2-scene-image-api.json', 'workflows/README.md',
        } or relative.startswith('workflows/local/') and relative.removeprefix('workflows/local/') in LOCAL_WORKFLOWS
        parts = Path(relative).parts
        if not allowed or any(part in ('.', '..') for part in parts):
            return None
        candidate = ROOT.joinpath(*parts)
        if ROOT not in candidate.resolve().parents or any(ROOT.joinpath(*parts[:i]).is_symlink() for i in range(1, len(parts)+1)):
            return None
        return candidate if candidate.is_file() else None

    def serve_public(self, head=False):
        file = self.public_file()
        if file is None:
            self.send_error(404, 'Public asset not found.')
            return
        self.send_response(200)
        self.send_header('Content-Type', self.guess_type(str(file)))
        self.send_header('Content-Length', str(file.stat().st_size))
        self.end_headers()
        if not head:
            with file.open('rb') as stream:
                shutil.copyfileobj(stream, self.wfile)

    def do_HEAD(self):
        if not self.allowed_read():
            self.send_error(403, 'Use this studio origin.')
            return
        # API HEAD does not bypass validation through the static file handler.
        if urlsplit(self.path).path.startswith('/api/'):
            self.send_response(405)
            self.send_header('Allow', 'GET, POST')
            self.end_headers()
            return
        self.serve_public(head=True)

    def proxy_comfy(self, method):
        upstream_path = self.path.removeprefix('/api/comfy')
        parsed = urlsplit(upstream_path)
        path = parsed.path
        comfy_url = self.server.comfy_url
        query = parse_qsl(parsed.query, keep_blank_values=True)
        expected = [v for k, v in query if k == '__studio_endpoint']
        if self.headers.get('X-Comfy-Endpoint'):
            expected.append(self.headers['X-Comfy-Endpoint'])
        if any(value != comfy_url for value in expected):
            self.json_response(409, {'error': 'ComfyUI address changed in another tab. Reload the studio before continuing.'})
            return
        upstream_path = urlunsplit(('', '', path, urlencode([(k, v) for k, v in query if k != '__studio_endpoint']), ''))
        permitted = (method == 'GET' and (path in ['/system_stats', '/object_info', '/queue', '/view'] or re.fullmatch(r'/history/[a-zA-Z0-9-]+', path))) or (method == 'POST' and path in ['/prompt', '/upload/image'])
        if not comfy_url or not permitted:
            self.json_response(404, {'error': 'ComfyUI proxy route is unavailable.'})
            return
        try:
            payload = None
            if method == 'POST':
                if self.headers.get('Transfer-Encoding'):
                    raise ValueError('Chunked request bodies are not supported.')
                self.connection.settimeout(60)
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 500 * 1024 * 1024:
                    raise ValueError('Invalid ComfyUI upload size.')
                payload = self.rfile.read(length)
                if len(payload) != length:
                    raise ValueError('ComfyUI upload was interrupted.')
            headers = {k: self.headers[k] for k in ['Content-Type', 'Range'] if k in self.headers}
            request = urllib.request.Request(comfy_url + upstream_path, data=payload, headers=headers, method=method)
            try:
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoAIRedirect())
                response = opener.open(request, timeout=120)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                content_type = response.headers.get('Content-Type', '').split(';')[0].strip().lower()
                if path == '/view' and 200 <= response.status < 300:
                    if content_type not in {'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac'}:
                        raise ValueError('ComfyUI view returned an unsupported media type.')
                else:
                    content_type = 'application/json'
                self.send_response(response.status)
                self.send_header('Content-Type', content_type)
                for key in ['Content-Length', 'Content-Range', 'Accept-Ranges']:
                    if response.headers.get(key):
                        self.send_header(key, response.headers[key])
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                shutil.copyfileobj(response, self.wfile)
        except (ValueError, OSError, urllib.error.URLError) as error:
            self.json_response(502, {'error': 'Network ComfyUI request failed: ' + str(error)})

    def do_GET(self):
        if not self.allowed_read():
            self.send_error(403, 'Use localhost or 127.0.0.1.')
            return
        path = urlsplit(self.path).path
        if path == '/api/studio/config':
            self.json_response(200, {'comfyEndpoint': self.server.comfy_url, 'token': self.server.token,
                                     'comfyEditable': bool(getattr(self.server, 'settings_file', None))})
        elif path.startswith('/api/comfy/'):
            self.proxy_comfy('GET')
        elif path == '/api/music/health':
            self.json_response(200, {'ffmpeg': bool(shutil.which('ffmpeg') and shutil.which('ffprobe')), 'outputScale': True, 'frameExtraction': True, 'storyAssembly': True, 'videoJoiner': True, 'token': self.server.token})
        elif path == '/api/ai/health':
            self.json_response(200, {'token': self.server.token})
        elif path.startswith(('/api/music/file/', '/api/music/frame/')):
            try:
                is_frame = path.startswith('/api/music/frame/')
                file = media_path(self.server.media, path.rsplit('/', 1)[-1])
                # SimpleHTTPRequestHandler supports streaming; public directory never includes uploads.
                self.send_response(200)
                self.send_header('Content-Type', 'image/png' if is_frame else 'video/mp4')
                self.send_header('Content-Length', str(file.stat().st_size))
                self.send_header('Content-Disposition', 'inline; filename="last-frame.png"' if is_frame else 'inline; filename="music-video.mp4"')
                self.end_headers()
                with file.open('rb') as stream:
                    shutil.copyfileobj(stream, self.wfile)
            except ValueError as error:
                self.json_response(404, {'error': str(error)})
        elif path.startswith('/api/'):
            self.json_response(404, {'error': 'Unknown studio API.'})
        else:
            self.serve_public()

    def do_POST(self):
        if not self.allowed_host() or self.headers.get('Origin') != f'http://{self.headers.get("Host")}' or self.headers.get('X-Studio-Token') != self.server.token:
            self.json_response(403, {'error': 'Finishing requests must come from this studio tab.'})
            return
        if urlsplit(self.path).path.startswith('/api/comfy/'):
            self.proxy_comfy('POST')
            return
        path = urlsplit(self.path).path
        try:
            if self.headers.get('Transfer-Encoding'):
                raise ValueError('Chunked request bodies are not supported.')
            self.connection.settimeout(60)
            length = int(self.headers.get('Content-Length', '0'))
            if path == '/api/studio/config':
                if (not 0 < length <= 4096 or self.headers.get('Transfer-Encoding') or
                        self.headers.get('Content-Type', '').split(';')[0] != 'application/json'):
                    raise ValueError('Send a bounded JSON connection setting.')
                self.connection.settimeout(10)
                raw = self.rfile.read(length)
                data = json.loads(raw)
                if not isinstance(data, dict) or set(data) != {'comfyEndpoint'}:
                    raise ValueError('Provide only the ComfyUI server address.')
                endpoint = save_comfy_origin(self.server, data['comfyEndpoint'])
                self.json_response(200, {'comfyEndpoint': endpoint, 'token': self.server.token, 'comfyEditable': True})
            elif path == '/api/ai/request':
                request_timeout = 1800
                if not 0 < length <= 2000000:
                    raise ValueError('Invalid AI request size.')
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError('Invalid AI request.')
                request_timeout = ai_timeout_seconds(data.get('timeoutSeconds', 1800))
                target = ai_target(data.get('endpoint', ''), data.get('route'))
                payload = data.get('payload')
                if data['route'] == 'chat/completions':
                    if not isinstance(payload, dict) or not isinstance(payload.get('messages'), list):
                        raise ValueError('Provide a chat request with messages.')
                    payload = {**payload, 'stream': False}
                elif payload is not None:
                    raise ValueError('Model discovery requires no chat payload.')
                headers = {'Content-Type': 'application/json'}
                key = data.get('apiKey', '')
                if not isinstance(key, str) or '\n' in key or '\r' in key:
                    raise ValueError('Invalid API key.')
                if key:
                    headers['Authorization'] = 'Bearer ' + key
                request = urllib.request.Request(target, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
                # Do not forward credentials through redirects or environment proxies.
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoAIRedirect())
                try:
                    response = opener.open(request, timeout=request_timeout if payload else 30)
                except urllib.error.HTTPError as error:
                    response = error
                with response:
                    body = response.read(8 * 1024 * 1024 + 1)
                    if len(body) > 8 * 1024 * 1024:
                        raise ValueError('AI response exceeds 8 MB.')
                    self.send_response(response.status)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(body)))
                    self.send_header('Cache-Control', 'no-store')
                    self.end_headers()
                    self.wfile.write(body)
            elif path == '/api/music/upload':
                if not 0 < length <= 500 * 1024 * 1024:
                    raise ValueError('Use a media file smaller than 500 MB.')
                with self.server.media_lock:
                    used = sum(p.stat().st_size for p in self.server.media.iterdir() if p.is_file())
                    if used + length > 8 * 1024**3:
                        raise ValueError('Finishing storage exceeds 8 GB. Restart the finishing server to clear temporary media.')
                    token = secrets.token_hex(16)
                    target = self.server.media / token
                    try:
                        with target.open('wb') as stream:
                            remaining = length
                            while remaining:
                                chunk = self.rfile.read(min(1024 * 1024, remaining))
                                if not chunk:
                                    raise ValueError('Upload was interrupted.')
                                stream.write(chunk)
                                remaining -= len(chunk)
                    except Exception:
                        target.unlink(missing_ok=True)
                        raise
                self.json_response(200, {'id': token})
            elif path == '/api/music/probe':
                if not 0 < length <= 10000:
                    raise ValueError('Invalid video probe request.')
                request = json.loads(self.rfile.read(length))
                if not isinstance(request, dict):
                    raise ValueError('Invalid video probe request.')
                self.json_response(200, probe_video(self.server.media, request))
            elif path == '/api/music/last-frame':
                if not 0 < length <= 10000:
                    raise ValueError('Invalid frame extraction request size.')
                request = json.loads(self.rfile.read(length))
                if not isinstance(request, dict):
                    raise ValueError('Invalid frame extraction request.')
                self.json_response(200, {'id': extract_frame(self.server.media, request)})
            elif path == '/api/music/context':
                if not 0 < length <= 10000:
                    raise ValueError('Invalid motion-context request.')
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError('Invalid motion-context request.')
                source = media_path(self.server.media, data.get('id'))
                frames, skip = data.get('frames'), data.get('skipFrames', 0)
                if type(frames) is not int or not 120 <= frames <= 336 or type(skip) is not int or skip not in [0, 22]:
                    raise ValueError('Invalid previous shot timing.')
                token = secrets.token_hex(16)
                target = self.server.media / token
                proc = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', *safe_input(source), '-an', '-vf', f'fps=24,trim=start_frame={skip+frames-22}:end_frame={skip+frames},setpts=N/(24*TB)', '-frames:v', '22', '-r', '24', '-fps_mode', 'cfr', '-c:v', 'libx264', '-crf', '16', '-threads', '2', '-f', 'mp4', str(target)], capture_output=True, timeout=120)
                if proc.returncode:
                    target.unlink(missing_ok=True)
                    raise ValueError('Unable to extract motion context from the previous video.')
                probe = subprocess.run(['ffprobe', *MEDIA_OPTIONS, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames', '-of', 'json', str(target)], capture_output=True, timeout=30)
                info = json.loads(probe.stdout) if probe.returncode == 0 else {}
                if not info.get('streams') or info['streams'][0].get('nb_frames') != '22':
                    target.unlink(missing_ok=True)
                    raise ValueError('The previous shot is too short for the approved motion context.')
                self.json_response(200, {'id': token})
            elif path == '/api/music/assemble':
                if not 0 < length <= 100000:
                    raise ValueError('Invalid assembly request size.')
                request = json.loads(self.rfile.read(length))
                if not isinstance(request, dict):
                    raise ValueError('Invalid assembly request.')
                if not self.server.assembly_lock.acquire(blocking=False):
                    self.json_response(409, {'error': 'Another video is already being assembled.'})
                    return
                try:
                    token = assemble(self.server.media, request)
                finally:
                    self.server.assembly_lock.release()
                self.json_response(200, {'id': token})
            else:
                self.json_response(404, {'error': 'Unknown studio API.'})
        except (TimeoutError, urllib.error.URLError) as error:
            timed_out = isinstance(error, TimeoutError) or isinstance(getattr(error, 'reason', None), TimeoutError)
            if path == '/api/ai/request' and timed_out:
                self.json_response(504, {'error': f'AI request timed out after {request_timeout // 60} minutes. Increase AI request timeout in AI connections or check the AI server. Completed clips are retained.'})
            else:
                self.json_response(502, {'error': 'Network request failed: ' + str(error)})
        except (ValueError, KeyError, OSError, subprocess.TimeoutExpired) as error:
            self.json_response(400, {'error': str(error)})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8099)
    parser.add_argument('--comfy-url', default='http://127.0.0.1:8188', help='Initial ComfyUI URL; a saved in-app address takes precedence.')
    parser.add_argument('--settings-file', type=Path,
                        default=Path(os.environ.get('STUDIO_SETTINGS_FILE', str(Path.home() / '.local/state/comfyui-studio/settings.json'))),
                        help='Persistent ComfyUI connection settings, outside the public app directory.')
    args = parser.parse_args()
    if args.comfy_url:
        url = urlsplit(args.comfy_url)
        if url.scheme not in ['http', 'https'] or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ['', '/']:
            parser.error('Use an HTTP(S) ComfyUI origin without credentials or path.')
    settings_file = args.settings_file.expanduser().resolve()
    if settings_file == ROOT or ROOT in settings_file.parents:
        parser.error('Keep connection settings outside the public app directory.')
    try:
        configured_comfy = saved_comfy_origin(settings_file, args.comfy_url)
    except (ValueError, KeyError, OSError) as error:
        parser.error('Cannot read saved ComfyUI settings: ' + str(error))
    os.umask(0o077)
    with tempfile.TemporaryDirectory(prefix='comfyui-music-studio-') as media:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), StudioHandler)
        server.comfy_url = configured_comfy
        server.settings_file = settings_file
        server.settings_lock = threading.Lock()
        server.media = Path(media)
        server.token = secrets.token_hex(32)
        server.media_lock = threading.Lock()
        server.assembly_lock = threading.Lock()
        print(f'Studio: http://127.0.0.1:{server.server_port} — temporary outputs last until server shutdown.', flush=True)
        def stop(signum, frame):
            raise KeyboardInterrupt
        signal.signal(signal.SIGTERM, stop)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()


if __name__ == '__main__':
    main()
