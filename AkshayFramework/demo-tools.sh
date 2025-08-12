#!/bin/bash

# Demo tools for Akshay's Framework
# These simulate the actual security tools for demo purposes

case "$1" in
  "subfinder")
    echo "Running Subfinder simulation..."
    echo "www.example.com" > "$3"
    echo "mail.example.com" >> "$3"
    echo "blog.example.com" >> "$3"
    echo "api.example.com" >> "$3"
    echo "admin.example.com" >> "$3"
    sleep 2
    echo "Subfinder completed - found 5 subdomains"
    ;;
  
  "httpx")
    echo "Running HTTPx simulation..."
    while IFS= read -r line; do
      echo "https://$line [200] [Technology: Apache,PHP]" >> "$3"
    done < "$2"
    sleep 3
    echo "HTTPx completed - probed $(wc -l < "$2") hosts"
    ;;
  
  "nuclei")
    echo "Running Nuclei simulation..."
    echo "[HIGH] SQL Injection found at https://api.example.com/search?q=" >> "$3"
    echo "[MEDIUM] XSS vulnerability at https://blog.example.com/comment" >> "$3"
    echo "[LOW] Directory listing at https://admin.example.com/backup/" >> "$3"
    sleep 4
    echo "Nuclei completed - found 3 vulnerabilities"
    ;;
  
  "nmap")
    echo "Running Nmap simulation..."
    echo "22/tcp   open  ssh" >> "$3"
    echo "80/tcp   open  http" >> "$3"
    echo "443/tcp  open  https" >> "$3"
    echo "3306/tcp open  mysql" >> "$3"
    sleep 3
    echo "Nmap completed - scanned ports"
    ;;
  
  *)
    echo "Demo tool simulation for $1"
    echo "Demo output from $1" > "$3"
    sleep 2
    echo "$1 simulation completed"
    ;;
esac