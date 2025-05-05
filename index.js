const express = require("express");
const session = require('express-session');
const flash = require('connect-flash');
const app = express();
const port = process.env.PORT || 3000;
const expressHbs = require("express-handlebars");
const moment = require('moment'); 

const path = require("path");
const models = require("./models"); // Import models to use Sequelize


// Flash messages setup
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
app.use(flash());

// Check authentication
function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    console.log("Checking authentication success:", req.session);
    next();
  } else {
    console.log("Checking authentication failed:", req.session);
    req.flash('errorMessage', 'You must be logged in to view this page.');
    res.redirect("/Login"); // Redirect to login if not authenticated
  }
}

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.static(__dirname + "/public"));

app.engine(
    'hbs', 
    expressHbs.engine({
        layoutsDir: __dirname + "/views/layouts",
        partialsDir: __dirname + "/views/partials",
        extname: "hbs",
        defaultLayout: "layout",
        runtimeOptions: {
          allowProtoPropertiesByDefault: true,
      },
        helpers: {
          includes: (array, value) => {
            return Array.isArray(array) && array.includes(value);
          },
            eq: function (a, b) {
              return a === b; // Return true if a and b are strictly equal
            },
            formatDate: (date) => {
              return new Date(date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
              });
          },
            timeAgo: (createdAt) => {
              const now = moment();
              const then = moment(createdAt);
              const duration = moment.duration(now.diff(then));
              
              if (duration.asSeconds() < 60) {
                return 'Just now';
              } else if (duration.asMinutes() < 60) {
                return `${Math.floor(duration.asMinutes())}m`;
              } else if (duration.asHours() < 24) {
                return `${Math.floor(duration.asHours())}h`;
              } else {
                return then.fromNow(); 
              }
            },
        },
    })
);
app.set("view engine", "hbs");

// Middleware to parse JSON 
app.use(express.json());
app.use(express .urlencoded({ extended: false }));


app.get("/", (req,res) => res.redirect("/Login"));

app.use("/Homepage", ensureAuthenticated, require("./routes/pageRouter"));
app.use("/Video", ensureAuthenticated, require("./routes/videoRouter"));
app.use("/Profile", ensureAuthenticated, require("./routes/profileRouter"));

app.use("/Login", require("./routes/loginRouter"));
//app.use("/CreateAccount", require("./routes/createRouter"));


app.listen(port, () => console.log(`listening on port ${port}`));