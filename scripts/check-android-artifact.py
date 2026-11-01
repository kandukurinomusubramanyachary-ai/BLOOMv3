"""Inspect bundled pose model and arm64 ELF load alignment in a built APK."""
import hashlib, pathlib, struct, sys, zipfile

def verify(filename):
    checked = 0
    with zipfile.ZipFile(filename) as apk:
        model = apk.read('assets/pose_landmarker_lite.task')
        expected = pathlib.Path(__file__).resolve().parent.parent / 'modules/bloom-pose/ios/Resources/pose_landmarker_lite.task'
        if hashlib.sha256(model).digest() != hashlib.sha256(expected.read_bytes()).digest():
            raise ValueError('Bundled pose model differs from the reviewed source')
        if len(model) < 5_000_000:
            raise ValueError('Pose model is absent or truncated')
        for name in apk.namelist():
            if not name.startswith('lib/arm64-v8a/') or not name.endswith('.so'):
                continue
            data = apk.read(name)
            if data[:6] != b'\x7fELF\x02\x01':
                raise ValueError('Unsupported ELF format: ' + name)
            offset = struct.unpack_from('<Q', data, 32)[0]
            size, count = struct.unpack_from('<HH', data, 54)
            loads = [struct.unpack_from('<Q', data, offset + i * size + 48)[0]
                     for i in range(count) if struct.unpack_from('<I', data, offset + i * size)[0] == 1]
            if not loads or min(loads) < 16384:
                raise ValueError('ELF load alignment below 16 KB: ' + name)
            checked += 1
    if not checked:
        raise ValueError('No arm64 native libraries inspected')
    print('PASS: complete pose model and 16 KB ELF alignment in', checked, 'arm64 libraries')

if __name__ == '__main__':
    verify(sys.argv[1])
