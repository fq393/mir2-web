"""Real sockets: losing the launcher's stderr must not kill HTTP responses."""
import importlib.util
import http.client
from pathlib import Path
import os
import sys
import threading

spec=importlib.util.spec_from_file_location('mirserve',Path(__file__).with_name('serve.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
server=m.http.server.ThreadingHTTPServer(('127.0.0.1',0),m.Handler)
thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
read,write=os.pipe();os.close(read)
broken=os.fdopen(write,'w',buffering=1);old=sys.stderr
try:
 sys.stderr=broken
 for path,expected in [('/__mir2_health',200),('/',200),('/not-a-real-mir-asset',404)]:
  connection=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=3)
  connection.request('GET',path);response=connection.getresponse();body=response.read();connection.close()
  assert response.status==expected,(path,response.status)
  assert body,path
finally:
 sys.stderr=old
 server.shutdown();server.server_close()
 try:broken.close()
 except BrokenPipeError:pass
print('PASS: health, page and missing asset respond with broken launcher stderr')
