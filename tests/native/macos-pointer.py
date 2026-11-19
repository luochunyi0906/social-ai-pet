"""Controlled cursor movement or mouse-down routing checks for an isolated Mac QA session."""
import ctypes as c
import json
import sys

CG = c.CDLL('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
CF = c.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
objc = c.CDLL('/usr/lib/libobjc.A.dylib')


class Point(c.Structure):
    _fields_ = [('x', c.c_double), ('y', c.c_double)]


class Rect(c.Structure):
    _fields_ = [('x', c.c_double), ('y', c.c_double), ('w', c.c_double), ('h', c.c_double)]


CG.CGEventCreate.argtypes = [c.c_void_p]
CG.CGEventCreate.restype = c.c_void_p
CG.CGEventGetLocation.argtypes = [c.c_void_p]
CG.CGEventGetLocation.restype = Point
CG.CGWarpMouseCursorPosition.argtypes = [Point]
CG.CGWarpMouseCursorPosition.restype = c.c_int
CG.CGPreflightPostEventAccess.restype = c.c_bool
CF.CFRelease.argtypes = [c.c_void_p]


def location():
    event = CG.CGEventCreate(None)
    try:
        point = CG.CGEventGetLocation(event)
        return {'x': point.x, 'y': point.y}
    finally:
        CF.CFRelease(event)


def route(x, y, below=0):
    c.CDLL('/System/Library/Frameworks/AppKit.framework/AppKit')
    objc.objc_getClass.argtypes = [c.c_char_p]
    objc.objc_getClass.restype = c.c_void_p
    objc.sel_registerName.argtypes = [c.c_char_p]
    objc.sel_registerName.restype = c.c_void_p
    send_object = c.CFUNCTYPE(c.c_void_p, c.c_void_p, c.c_void_p)(('objc_msgSend', objc))
    send_object(objc.objc_getClass(b'NSApplication'), objc.sel_registerName(b'sharedApplication'))
    window_number = c.CFUNCTYPE(c.c_long, c.c_void_p, c.c_void_p, Point, c.c_long)(('objc_msgSend', objc))
    # AppKit's global Y axis runs upward from the bottom of the primary screen.
    CG.CGDisplayBounds.argtypes = [c.c_uint32]
    CG.CGDisplayBounds.restype = Rect
    CG.CGMainDisplayID.restype = c.c_uint32
    height = CG.CGDisplayBounds(CG.CGMainDisplayID()).h
    return window_number(objc.objc_getClass(b'NSWindow'),
                         objc.sel_registerName(b'windowNumberAtPoint:belowWindowWithWindowNumber:'),
                         Point(x, height - y), below)


def windows(pid):
    import plistlib
    CG.CGWindowListCopyWindowInfo.argtypes = [c.c_uint32, c.c_uint32]
    CG.CGWindowListCopyWindowInfo.restype = c.c_void_p
    CF.CFPropertyListCreateData.argtypes = [c.c_void_p,c.c_void_p,c.c_long,c.c_ulong,c.c_void_p]
    CF.CFPropertyListCreateData.restype = c.c_void_p
    CF.CFDataGetLength.argtypes = [c.c_void_p]
    CF.CFDataGetLength.restype = c.c_long
    CF.CFDataGetBytePtr.argtypes = [c.c_void_p]
    CF.CFDataGetBytePtr.restype = c.c_void_p
    entries = CG.CGWindowListCopyWindowInfo(17,0)
    data = CF.CFPropertyListCreateData(None,entries,100,0,None)
    try:
        rows = plistlib.loads(c.string_at(CF.CFDataGetBytePtr(data),CF.CFDataGetLength(data)))
        return [{'number': row['kCGWindowNumber'], 'bounds': row.get('kCGWindowBounds')}
                for row in rows if row.get('kCGWindowOwnerPID') == pid]
    finally:
        CF.CFRelease(data)
        CF.CFRelease(entries)


if __name__ == '__main__':
    name = sys.argv[1]
    if name == 'position':
        print(json.dumps(location()))
    elif name == 'warp':
        result = CG.CGWarpMouseCursorPosition(Point(float(sys.argv[2]), float(sys.argv[3])))
        print(json.dumps({'error': result, 'position': location()}))
    elif name == 'route':
        print(route(float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else 0))
    elif name == 'windows':
        print(json.dumps(windows(int(sys.argv[2]))))
    elif name == 'access':
        print(json.dumps({'postsEvents': CG.CGPreflightPostEventAccess()}))
