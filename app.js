const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const convertStateDbObjectToResponse = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.stateName,
    population: dbObject.population,
  };
};

const convertDistrictObjectToResponse = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken.verify(jwtToken, "SECRET_KEY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `SELECT * FROM user WHERE username='${username}';`;
  const dataUser = await db.get(selectUser);
  if (dataUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordThere = await bcrypt.compare(password, dataUser.password);

    if (passwordThere === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET_KEY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticateToken, async (request, response) => {
  const statesQuery = `SELECT * FROM state;`;
  const statesArr = await db.all(statesQuery);
  response.send(
    statesArr.map((eachState) => convertStateDbObjectToResponse(eachState))
  );
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getState = `
    SELECT * FROM state WHERE state_id=${stateId};`;
  const state = await db.get(getState);
  response.send(convertStateDbObjectToResponse(state));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postQuery = `
    INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES
    ('${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths});`;
  await db.run(postQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  " /districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `SELECT * FROM district WHERE district_id=${districtId};`;
    const district = await db.get(getDistrict);
    response.send(convertDistrictObjectToResponse(district));
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const putQuery = `
    UPDATE district SET district_name='${districtName}',
    ${stateId},${cases},${cured},${active},${deaths}
    WHERE district_id=${districtId};`;
    await db.run(putQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `
    SELECT 
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
        FROM district WHERE state_id=${stateId};`;
    const stats = await db.get(statsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
module.exports = app;
