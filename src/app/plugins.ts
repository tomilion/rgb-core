/* eslint-disable @typescript-eslint/no-empty-function */
import { Application } from "lisk-sdk";
import { PixelPlugin } from "./plugins/pixel/pixel_plugin";

export const registerPlugins = (app: Application): void => {
    app.registerPlugin(PixelPlugin);
};
