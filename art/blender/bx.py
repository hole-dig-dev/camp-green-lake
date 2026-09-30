#!/usr/bin/env python3
"""Run Python inside the live Blender (blender-mcp socket on :9876). Usage: bx.py file.py | bx.py -c 'code'
A build script whose first line is '# blend: NAME.blend' runs in that file (next to the script): bx.py opens it
first unless it's already the open file. The .blend files are saved compressed; Blender keeps that on every save."""
import socket,json,sys,os,re
OPEN=None
if sys.argv[1]=='-c':code=sys.argv[2]
else:
    code=open(sys.argv[1]).read()
    m=re.match(r'# blend: ([\w.-]+\.blend)',code)
    if m:
        f=os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])),m.group(1))
        OPEN=f"import bpy\nif bpy.data.filepath!={f!r}:bpy.ops.wm.open_mainfile(filepath={f!r})"
def run(code):   # the open has to be its own call: after open_mainfile the same call has no window context
    s=socket.create_connection(('127.0.0.1',9876),timeout=600);s.sendall(json.dumps({"type":"execute_code","params":{"code":code}}).encode())
    buf=b'';r=None
    while True:
        c=s.recv(1<<20)
        if not c:break
        buf+=c
        try:r=json.loads(buf);break
        except json.JSONDecodeError:continue
    if r is None:print('ERROR: Blender closed the connection (crashed?); see /tmp/*.crash.txt');sys.exit(1)
    if r.get('status')!='success':print('ERROR',r);sys.exit(1)
    res=r.get('result');return res.get('result','') if isinstance(res,dict) else res
if OPEN:run(OPEN)
print(run(code))
