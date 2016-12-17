# happn-cluster-conductor

Conduct a set of cluster nodes to perform benchmark activities and accumulate results to and from a central location.

## Setup

Ensure all necessary ports are accessible between nodes ([see similar aws example](https://github.com/happner/happn-cluster-aws-example#step-1-create-aws-security-groups))

All nodes using ubuntu 14:04 (or any with upstart)

### create mongo server

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

### create conductor server

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
git clone https://github.com/happner/happn-cluster-conductor.git # this repo
cd happn-cluster-conductor/
npm install
exit # back to root

# move the init script into position and adjust

cp /home/happn/happn-cluster-conductor/init/happn-cluster.conf /etc/init
vi /etc/init/happn-cluster.conf
```

### create conductor client

Create multiple of these... (one client per host)
