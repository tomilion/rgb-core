import { Application } from "lisk-sdk";
import { StatisticsPlugin } from "./plugins/statistics/statistics_plugin";
import { TimelapsePlugin } from "./plugins/timelapse/timelapse_plugin";
import { ViewPlugin } from "./plugins/view/view_plugin";

export const registerPlugins = (app: Application): void => {
    if (StatisticsPlugin.alias in app.config.plugins)
    {
        app.registerPlugin(StatisticsPlugin);
    }

    if (TimelapsePlugin.alias in app.config.plugins)
    {
        app.registerPlugin(TimelapsePlugin);
    }

    if (ViewPlugin.alias in app.config.plugins)
    {
        app.registerPlugin(ViewPlugin);
    }
};
