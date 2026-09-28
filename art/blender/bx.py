#!/usr/bin/env python3
"""Run Python inside the live Blender (blender-mcp socket on :9876). Usage: bx.py file.py | bx.py -c 'code'"""
import socket,json,sys
code=sys.argv[2] if sys.argv[1]=='-c' else open(sys.argv[1]).read()
s=socket.create_connection(('127.0.0.1',9876),timeout=600);s.sendall(json.dumps({"type":"execute_code","params":{"code":code}}).encode())
buf=b''
while True:
    c=s.recv(1<<20)
    if not c:break
    buf+=c
    try:r=json.loads(buf);break
    except json.JSONDecodeError:continue
if r.get('status')!='success':print('ERROR',r);sys.exit(1)
res=r.get('result');print(res.get('result','') if isinstance(res,dict) else res)
