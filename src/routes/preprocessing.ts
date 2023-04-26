import { Router } from "express";
import * as preprocessingController from "../controllers/preprocessing";
export const PreprocessingRouter: Router = Router();

PreprocessingRouter.post("/preprocess", preprocessingController.preprocess);
