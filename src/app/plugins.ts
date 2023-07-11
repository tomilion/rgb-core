import { Application } from "lisk-sdk";
import { ViewPlugin } from "./plugins/view/view_plugin";
import { TimelapsePlugin } from "./plugins/timelapse/timelapse_plugin";

export const registerPlugins = (app: Application): void => {
    if (ViewPlugin.alias in app.config.plugins)
    {
        app.registerPlugin(ViewPlugin);
    }

    if (TimelapsePlugin.alias in app.config.plugins)
    {
        app.registerPlugin(TimelapsePlugin);
    }
};
