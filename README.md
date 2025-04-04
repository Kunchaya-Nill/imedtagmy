How to in stall in Terminal

first you have to get [node js](https://nodejs.org/en). and [MySQL](https://dev.mysql.com/downloads/installer/).

```
mkdir (Whatever you want to name your folder)
cd (your folder's name)
mkdir uploads
mkdir public
```

your outside folder should be like this

![image](https://github.com/user-attachments/assets/be0516d1-7aa7-4f03-add0-582d367e691b)


```
npm install mysql2
npm install cors
npm init -y
npm install bcryptjs jsonwebtoken
npm install express multer cors
npm install express multer mysql2 cors
node server.js
```

incase after running server and you found The error "EADDRINUSE: address already in use" means that port 5000 is already in use.
```
netstat -ano | findstr :5000
```
the result will be
TCP    127.0.0.1:5000     0.0.0.0:0     LISTENING     xxx
```
taskkill /PID xxx /F
node server.js
```
