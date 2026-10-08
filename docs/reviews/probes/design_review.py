import json,time,urllib.request,urllib.error,pathlib
base='http://localhost:8082/api/v1'
def req(path,data=None,method=None):
    request=urllib.request.Request(base+path,data=None if data is None else json.dumps(data).encode(),method=method,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(request,timeout=10) as response:
            text=response.read().decode();return response.status,json.loads(text) if text else None
    except urllib.error.HTTPError as error:
        return error.code,json.loads(error.read().decode())
for i in range(50):
    try:
        if req('/health')[0]==200:break
    except Exception:time.sleep(.2)
evidence={}
_,stream=req('/streams',{});stream=stream['streamId']
assert req('/streams/'+stream+'/replay',{'algorithm':'FWUDS_DWT','paneSize':2,'windowPaneCount':2,'minWus':.5,'transactionsPerSecond':0,'maxTransactions':4,'weightMode':'PROVIDED_UTILITY','weightBatchSize':1500,'seed':42})[0]<300
for i in range(100):
    _,job=req('/streams/'+stream+'/replay')
    if job['state']=='COMPLETED':break
    assert job['state']!='FAILED',job
    time.sleep(.1)
assert job['state']=='COMPLETED'
assert req('/streams/'+stream+'/transactions',method='DELETE')[0]==204
_,overview=req('/streams/'+stream+'/overview');status,job=req('/streams/'+stream+'/replay')
assert overview['transactionCount']==0 and job['processedTransactions']==4
evidence['staleReplayAfterReset']={'transactionCount':overview['transactionCount'],'httpStatus':status,'replayState':job['state'],'replayProcessedTransactions':job['processedTransactions'],'confirmed':True}
_,stream=req('/streams',{});stream=stream['streamId']
codes=[]
for i in range(4):
    code,body=req('/streams/'+stream+'/transactions',{'id':'zero'+str(i),'items':[{'itemId':'A','quantity':1,'weight':0}]});codes.append(code)
_,overview=req('/streams/'+stream+'/overview')
positiveCode,positiveBody=req('/streams/'+stream+'/transactions',{'id':'positive','items':[{'itemId':'A','quantity':1,'weight':1}]})
assert codes==[201,201,201,400] and overview['transactionCount']==4 and positiveCode==500
evidence['committedInputDespiteErrorAndBlockedContinuation']={'insertHttpStatuses':codes,'lastError':body,'archivedTransactionCount':overview['transactionCount'],'miningError':overview['miningError'],'nextPositiveInputStatus':positiveCode,'nextPositiveInputError':positiveBody,'confirmed':True}
_,stream=req('/streams',{});stream=stream['streamId']
assert req('/streams/'+stream+'/configuration',{'algorithm':'FWUDS_CT','paneSize':1,'windowPaneCount':1,'minWus':0})[0]==200
code,body=req('/streams/'+stream+'/transactions',{'id':'dense17','items':[{'itemId':'I'+str(i),'quantity':1,'weight':1} for i in range(17)]})
_,overview=req('/streams/'+stream+'/overview')
assert code==400 and overview['transactionCount']==1 and overview['miningError']
evidence['budgetFailureAfterCommit']={'httpStatus':code,'error':body,'archivedTransactionCount':overview['transactionCount'],'confirmed':True}
_,stream=req('/streams',{});stream=stream['streamId']
for i in range(4):assert req('/streams/'+stream+'/transactions',{'id':'valid'+str(i),'items':[{'itemId':'A','quantity':1,'weight':1}]})[0]==201
_,overview=req('/streams/'+stream+'/overview');session=overview['configuration']['sessionId']
code,body=req('/streams/'+stream+'/results/window?sessionId='+session+'&windowId=1&patternAfter=2147483647&limit=1000')
assert code==400, (code,body)
evidence['patternOffsetOverflow']={'httpStatus':code,'error':body,'confirmed':True}
pathlib.Path('docs/reviews/design-review-probes.json').write_text(json.dumps(evidence,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps(evidence,indent=2,ensure_ascii=True))

