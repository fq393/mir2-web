"""Exercise the local admin API and restore its baseline before returning.
Refuses to run if an existing custom experience override would be overwritten.
"""
import json,re,urllib.request,urllib.error
BASE='http://127.0.0.1:17080'
def get(path):return urllib.request.urlopen(BASE+path).read()
state=json.loads(get('/admin/config/experience'))
assert not state['custom'],'Existing custom override: run this test against an isolated instance.'
nonce=re.search(r"'X-Mir-CSRF':'([A-F0-9]+)'",get('/admin').decode()).group(1)
def post(body,token=nonce):
 req=urllib.request.Request(BASE+'/admin/config/experience',data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Origin':BASE,'X-Mir-CSRF':token})
 try:
  with urllib.request.urlopen(req) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read() or b'{}')
original=state['content'];etag=state['etag']
try:
 assert post({'etag':etag,'content':original},'invalid')[0]==403
 bad=json.loads(json.dumps(original));bad['requiredExperience'][0]=0
 assert post({'etag':etag,'content':bad})[0]==400
 modified=json.loads(json.dumps(original));modified['requiredExperience'][0]+=1
 code,saved=post({'etag':etag,'content':modified});assert code==200
 changed=json.loads(get('/admin/config/experience'));assert changed['custom'] and changed['pending'] and changed['content']==modified
 assert post({'etag':etag,'content':original})[0]==409
 assert post({'etag':changed['etag'],'restore':True})[0]==200
 restored=json.loads(get('/admin/config/experience'));assert not restored['custom'] and restored['content']==original and restored['etag']==etag
 print('PASS admin CSRF, invalid numeric input, persisted override/readback, stale edit conflict and exact baseline restoration. No gameplay restart while modified.')
finally:
 current=json.loads(get('/admin/config/experience'))
 if current['custom']:assert post({'etag':current['etag'],'restore':True})[0]==200
