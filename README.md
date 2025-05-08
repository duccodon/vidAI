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

### 3. Environment Setup
Create a .env file in the root directory and configure it with the necessary API keys and credentials. Use the following template as a guide:
```bash
GEMINI_API_KEY=your_gemini_api_key
PUBMED_API_KEY=your_pubmed_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GROQ_API_KEY=your_groq_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
YOUTUBE_API_KEY=your_youtube_api_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/Video/google/callback
```
Note:
- Do not commit the .env file to version control (e.g., Git). Ensure it is listed in .gitignore to prevent accidental exposure of sensitive credentials.
- Replace placeholder values (e.g., your_gemini_api_key) with actual keys obtained from the respective services.

### 4. Database Setup
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

### 5. Seed Data with Sequelize
To populate the database with initial data (e.g., sample users, videos, or configurations), use Sequelize's seeding functionality. Run the following command:
```bash
npx sequelize-cli db:seed:all
```
Note:
- Ensure that seed files are present in the seeders directory. These files should be created using npx sequelize-cli seed:generate and populated with the desired data.
- To undo seeding, you can run npx sequelize-cli db:seed:undo:all.
- Verify seeded data in DBeaver by querying the relevant tables.

### 6. Run the application
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
