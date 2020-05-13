# friday
Blockchain framework for small DAPPS


## Install

Before you need install last version of node from nodejs.org and supervisor for daemon. 

```bash
cd
mkdir project
cd project
mkdir logs
git clone https://github.com/gettocat/friday.git .
npm install
node mainnet.js 
```

supervisor config
```
[program:friday]
command=node /home/%user%/project/index.js            ; the program (relative uses PATH, can take args)
process_name=%(program_name)s_%(process_num)02d ; process_name expr (default %(program_name)s)
numprocs=1                    ; number of processes copies to start (def 1)
directory=/home/%user%/project                ; directory to cwd to before exec (def no cwd)
autostart=true                ; start at supervisord start (default: true)
user=root                   ; setuid to this UNIX account to run the program
redirect_stderr=true          ; redirect proc stderr to stdout (default false)
stdout_logfile=/home/%user%/project/logs/log.txt        ; stdout log path, NONE for none; default AUTO
stdout_logfile_maxbytes=5MB   ; max # logfile bytes b4 rotation (default 50MB)
stdout_logfile_backups=20     ; # of stdout logfile backups (0 means none, default 10)
environment=LC_ALL="en_US.UTF-8",LANG="en_US.UTF-8",LANGUAGE="en_US.UTF-8"       ; process environment additions (def no adds)
autorestart=true
stderr_logfile=/home/%user%/project/logs/err.txt
redirect_stderr=true

```

add to supervisor
```
nano /etc/supervisor/conf.d/friday.conf
### paste config ---^ ###
/etc/init.d/supervisor restart
```
