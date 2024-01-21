import { Application } from "lisk-sdk";
import { CanvasModule } from "./modules/canvas/canvas_module";

export const registerModules = (app: Application): void => {
    app.registerModule(CanvasModule);
};
