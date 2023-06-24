/* eslint-disable @typescript-eslint/no-empty-function */
import { Application } from "lisk-sdk";
import { ViewPlugin } from "./plugins/view/view_plugin";

export const registerPlugins = (app: Application): void => {
    if (ViewPlugin.alias in app.config.plugins)
    {
        app.registerPlugin(ViewPlugin);
    }
};
