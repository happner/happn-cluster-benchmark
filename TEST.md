## Benchmark

### Bench 1

1 server

200 clients

10 groups

```bash
bin/runner \
 --conductor-url=https://conductor:55000 \
 --conductor-secret=aiph2Boh \
 --spawn-concurrency=3 \
 --cluster-size=1 \
 --client-count=200 \
 --client-groups=10 \
 --client-script=02-client \
 --stop-after-seconds=420 \
 --script-param-message-interval=1000 \
 --script-param-message-increment-interval=10000 \
 --script-param-increment=-25 \
 --script-param-report-interval=2000 \
 --script-param-averager-window-size=20 \
 --script-param-payload-size=200 \
 --script-param-no-store=1 \
 --output=bench1.json
```

### 













### Bench 1

1 server

200 clients

10 groups

```bash
bin/runner \
 --conductor-url=https://conductor:55000 \
 --conductor-secret=aiph2Boh \
 --spawn-concurrency=3 \
 --cluster-size=1 \
 --client-count=200 \
 --client-groups=10 \
 --client-script=02-client \
 --stop-after-seconds=420 \
 --script-param-message-interval=1000 \
 --script-param-message-increment-interval=10000 \
 --script-param-increment=-25 \
 --script-param-report-interval=2000 \
 --script-param-averager-window-size=20 \
 --script-param-payload-size=200 \
 --script-param-no-store=1 \
 --output=bench1.json
```

### Bench 2

5 server

200 clients

10 groups

```bash
bin/runner \
 --conductor-url=https://conductor:55000 \
 --conductor-secret=aiph2Boh \
 --spawn-concurrency=3 \
 --cluster-size=5 \
 --client-count=200 \
 --client-groups=10 \
 --client-script=02-client \
 --stop-after-seconds=420 \
 --script-param-message-interval=1000 \
 --script-param-message-increment-interval=10000 \
 --script-param-increment=-25 \
 --script-param-report-interval=2000 \
 --script-param-averager-window-size=20 \
 --script-param-payload-size=200 \
 --script-param-no-store=1 \
 --output=bench2.json
```

### Bench 3

10 servers

200 clients

10 groups

```bash
bin/runner \
 --conductor-url=https://conductor:55000 \
 --conductor-secret=aiph2Boh \
 --spawn-concurrency=3 \
 --cluster-size=10 \
 --client-count=200 \
 --client-groups=10 \
 --client-script=02-client \
 --stop-after-seconds=420 \
 --script-param-message-interval=1000 \
 --script-param-message-increment-interval=10000 \
 --script-param-increment=-25 \
 --script-param-report-interval=2000 \
 --script-param-averager-window-size=20 \
 --script-param-payload-size=200 \
 --script-param-no-store=1 \
 --output=bench3.json
```

### Bench 4

15 servers

200 clients

10 groups

```bash
bin/runner \
 --conductor-url=https://conductor:55000 \
 --conductor-secret=aiph2Boh \
 --spawn-concurrency=3 \
 --cluster-size=15 \
 --client-count=200 \
 --client-groups=10 \
 --client-script=02-client \
 --stop-after-seconds=420 \
 --script-param-message-interval=1000 \
 --script-param-message-increment-interval=10000 \
 --script-param-increment=-25 \
 --script-param-report-interval=2000 \
 --script-param-averager-window-size=20 \
 --script-param-payload-size=200 \
 --script-param-no-store=1 \
 --output=bench4.json
```

### Bench 5

20 servers

200 clients

10 groups

```bash
bin/runner \
 --conductor-url=https://conductor:55000 \
 --conductor-secret=aiph2Boh \
 --spawn-concurrency=3 \
 --cluster-size=20 \
 --client-count=200 \
 --client-groups=10 \
 --client-script=02-client \
 --stop-after-seconds=420 \
 --script-param-message-interval=1000 \
 --script-param-message-increment-interval=10000 \
 --script-param-increment=-25 \
 --script-param-report-interval=2000 \
 --script-param-averager-window-size=20 \
 --script-param-payload-size=200 \
 --script-param-no-store=1 \
 --output=bench5.json
```

