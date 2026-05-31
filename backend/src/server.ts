import express from "express";
import type {Application} from "express";
import dotenv from 'dotenv';
import { projectRouter } from "./routes/project.routes.js";

dotenv.config();
const app: Application = express();
const port = Number(process.env.PORT);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "CreatorLens backend is running",
  });
});


app.use("/api/projects", projectRouter);
app.listen(port, ()=>{
    console.log(`Server started Listening on port: ${port}`);
})