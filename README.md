# vidAI Project

Welcome to the **vidAI** project!  
This repository contains the codebase for a web application that allows users to input a topic and automatically generate a video, including script writing, text-to-speech audio, and relevant images. Users can then combine and edit these materials into a final video ready for YouTube publishing.

---

## 🚀 Prerequisites

Make sure the following tools are installed on your machine:

- [Node.js](https://nodejs.org/) (v14 or later recommended)  
- npm (comes with Node.js)  
- [PostgreSQL](https://www.postgresql.org/) (for database)  
- [DBeaver](https://dbeaver.io/) (for database management)  
- [Nodemon](https://nodemon.io/) (optional, for development)

---

## ⚙️ Installation via Command Line

### 1. Clone the Repository

```bash
git clone https://github.com/duccodon/vidAI.git
cd vidAI

```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
Create config/config.json with the following content, while developing you just need to edit the development field:
```bash
{
  "development": {
    "username": "your_username connection in DBeaver",
    "password": "your_password",
    "database": "your_db_name",
    "host": "127.0.0.1",
    "dialect": "postgres"
  },
  "test": {
    "username": "root",
    "password": null,
    "database": "database_test",
    "host": "127.0.0.1",
    "dialect": "mysql"
  },
  "production": {
    "username": "root",
    "password": null,
    "database": "database_production",
    "host": "127.0.0.1",
    "dialect": "mysql"
  }
}
```

In DBeaver, create connection with postgres and then create a postgreSQL database. Then pass that name of database to database in the config.json. You can test if the connection is successfull by cliking the button "Test Connection ... " before creating a database. 

Create table using command line
```bash
node db
```
After that, go back to your database, refresh it and see if the tables have been created successfully.

### 4. Run the application
If you did not download Nodemon you can use
```bash
node index
//then go to any browser and type localhost:3000
```
Another way you can do is using Nodemon, with Nodemon you do not need to restart the application every time you modify the source code
```bash
nodemon
```
> 📝 **Note:** You can use `Ctrl + C` to interrupt the process.
