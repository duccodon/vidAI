const models = require("./models");

models.sequelize.sync().then(() => {
    console.log("Tables created!");
});