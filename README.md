# happn-cluster-benchmark

Conduct a set of cluster nodes (wokers) to perform benchmark activities and accumulate results to and from a central location (conductor).

## Setup

Ensure all necessary ports are accessible between nodes ([see similar aws example](https://github.com/happner/happn-cluster-aws-example#step-1-create-aws-security-groups))

All nodes using ubuntu 14:04 (or any with upstart)

### create mongo server

create mongodb on separate server

```bash
sudo -s
apt-get update
apt-get install mongodb -y
vi /etc/mongodb.conf

## change to listen on all ports
bind_ip = 0.0.0.0
##

restart mongodb
netstat -an | grep 27017 # confim listening 0.0.0.0

# get mongo server's address for MONGO_URL env var later
ifconfig eth0
```

### create benchmark conductor 

create only one conductor on separate server

```bash
sudo -s
apt-get update
apt-get install git build-essential -y

# install nodejs
# https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions (for updates to below)

curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
apt-get install nodejs
node --version

# create user to run cluster as

adduser --disabled-password happn

# install cluster software (as user)

su happn
cd ~/
git clone https://github.com/happner/happn-cluster-benchmark.git # this repo
cd happn-cluster-benchmark/
npm install
exit # back to root

# move the init script into position and adjust

cp /home/happn/happn-cluster-benchmark/init/happn-cluster-benchmark-conductor.conf /etc/init
vi /etc/init/happn-cluster-benchmark-conductor.conf
```

### create benchmark worker 

Create multiple of these... (one per server)

Suggestion: create aws image and then spawn multiple servers from that "AMI".

```bash
sudo -s
apt-get update
apt-get install git build-essential -y

# install nodejs
# https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions (for updates to below)

curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
apt-get install nodejs
node --version

# create user to run cluster as

adduser --disabled-password happn

# install cluster software (as user)

su happn
cd ~/
git clone https://github.com/happner/happn-cluster-benchmark.git # this repo
cd happn-cluster-benchmark/
npm install
exit # back to root

# move the init script into position and adjust

cp /home/happn/happn-cluster-benchmark/init/happn-cluster-benchmark-worker.conf /etc/init
vi /etc/init/happn-cluster-benchmark-worker.conf
```



## Usage

Start benchmark run using runner from bash shell

```bash
 bin/runner \
 --conductor-url=https://localhost:55000 \
 --conductor-secret=secret \
 --spawn-concurrency=3 \
 --cluster-size=3 \
 --client-count=20 \
 --stop-after-seconds=5 \
 --client-script=00-client \
 --script-param-custom1=xxx \
 --script-param-custom2=xxx \
 --output=file.json
```

#### --spawn-concurrency

When spawning a large cluster with all node concurrently, SWIM fails to disseminate properly - this limits the number of cluster nodes being spawned at once.

#### --cluster-size

Number of happn-cluster servers in the cluster spread evenly across all workers. 

see  `lib/worker/startClusterSeed` , `lib/worker/startClusterNode` 

#### --client-count

Number of happn-3 clients to spawn and login to a node in the cluster, spread evenly across all workers and cluster nodes.

#### --stop-after-seconds

Allow to for test script to run. Starts counting only after all clients have started.

#### --client-script

Which script to run. Script has access to the logged-in hapn client and facilities to relay results back to the conductor. See  `lib/worker/00-client` example.

#### --script-param-custom1

Custom parameter for specified benchmark script.