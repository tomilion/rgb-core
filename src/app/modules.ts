/* eslint-disable @typescript-eslint/no-empty-function */
import { Application } from "lisk-sdk";
import { CanvasModule } from "./modules/canvas/canvas_module";

// @ts-expect-error Unused variable error happens here until at least one module is registered
export const registerModules = (app: Application): void => {
    app.registerModule(CanvasModule);
};
