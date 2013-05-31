wetlab
======

Readme for smart wet lab repo.  

=====================
Setting up the server
=====================

Steps from a generic Ubuntu 12.10 machine. (Probably works from 12.04 as well.)

1. install Git
> sudo apt-get install git-core

2. check out the wetlab git tree
> git clone https://github.com/lamarca/wetlab

3. install couchdb
> sudo apt-get install couchdb -y

4. Check that couchdb is running.
> fetch http://localhost:5984/_utils/
it should show something nice

5. install node.js and the stuff it likes. (this list came from the node.js page)
> sudo apt-get install python-software-properties python g++ make
> sudo add-apt-repository ppa:chris-lea/node.js
> sudo apt-get update
> sudo apt-get install nodejs

6. Add the cradle package for node to access couchdb
> sudo npm install cradle -g

7. Add the ssh package to allow connections to the machines driving the sensors
> sudo npm install ssh2 -g

=================
To Run the server
=================

1. Make sure the added node modules are on your path
  - In windows: set NODE_PATH=C:\Documents and Settings\<userid>\Application Data\npm\node_modules
     (for me: set NODE_PATH=C:\Documents and Settings\lamarca\Application Data\npm\node_modules  )
  - In linux: 

optional stuff:

- Download Komodo edit. It's a nice editor for node.js
> wget http://downloads.activestate.com/Komodo/releases/8.0.1/Komodo-Edit-8.0.1-12353-linux-x86.tar.gz
> tar xzvf Komodo-Edit-8.0.1-12353-linux-x86.tar.gz
> cd Komodo-Edit-8.0.1-12353-linux-x86
> sudo ./install.sh
(when asked for installdir put: /opt/Komodo-Edit-8/)
> export PATH="/opt/Komodo-Edit-8/bin:$PATH"
> komodo (to run editor)
