/**
 * Discord Quest Completer - Automated Script
 *
 * This script interacts with Discord's internal Webpack modules to automate
 * the completion of "Quests" (Drops). It supports Video, Gameplay, and Streaming tasks.
 *
 * WARNING: This script uses internal APIs. Use at your own risk.
 */

(() => {
    // Clear console for a clean output state on start
    console.clear();

    // ============================================================================
    // UTILITIES & LOGGING
    // ============================================================================

    /**
     * Logger utility to provide formatted, color-coded output in the DevTools console.
     * Uses CSS styling for better readability.
     */
    const logger = {
        log: (msg, color = "#00b0f4") => console.log(`%c[QuestBot] %c${msg}`, "color: #7289da; font-weight: bold; background: #2c2f33; padding: 2px 5px; border-radius: 3px;", `color: ${color}; font-weight: bold;`),
        info: (msg) => console.log(`%c ℹ️ %c${msg}`, "font-size: 14px;", "color: #b9bbbe;"),
        success: (msg) => console.log(`%c ✅ %c${msg}`, "font-size: 14px;", "color: #43b581; font-weight: bold;"),
        warn: (msg) => console.log(`%c ⚠️ %c${msg}`, "font-size: 14px;", "color: #faa61a;"),
        /**
         * Renders a visual progress bar in the console.
         * @param {number} current - Current progress (seconds)
         * @param {number} total - Target progress (seconds)
         */
        bar: (current, total) => {
            const safeTotal = total > 0 ? total : 1;
            const percentage = Math.min(100, (current / safeTotal) * 100);
            const filled = Math.floor(percentage / 5); // 20 segments total
            const empty = 20 - filled;
            const bar = "█".repeat(filled) + "░".repeat(empty);
            const color = percentage >= 100 ? "#43b581" : "#00b0f4";
            console.log(`%c[${bar}] %c${percentage.toFixed(1)}% %c(${current}/${total}s)`, `color: ${color}; font-family: monospace;`, `color: ${color}; font-weight: bold;`, "color: #72767d;");
        }
    };

    logger.log("Initializing script...", "white");

    // ============================================================================
    // WEBPACK INJECTION & MODULE RETRIEVAL
    // ============================================================================

    // Remove existing jQuery reference if present to avoid conflicts
    delete window.$;

    let wpRequire;

    // Attempt to intercept the Webpack chunk loader to expose the 'require' function.
    // This allows us to import internal Discord modules dynamically.
    try {
        wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop(); // Clean up the stack
    } catch (e) {
        logger.warn("Could not retrieve webpackChunkdiscord_app. Are you running this in the Discord Client or Web App?");
        return;
    }

    if (!wpRequire?.c) {
        logger.warn("Webpack module cache could not be accessed.");
        return;
    }

    // Define variables for internal Stores
    let ApplicationStreamingStore, RunningGameStore, QuestsStore, ChannelStore, GuildChannelStore, FluxDispatcher, api;

    try {
        const modules = Object.values(wpRequire.c);
        const findModule = (filter) => modules.find(x => {
            try {
                return filter(x);
            } catch {
                return false;
            }
        });

        // 1. Try finding modules using the current Discord selectors (A/Ay/h/Bo + __proto__)
        ApplicationStreamingStore = findModule(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A;
        RunningGameStore = findModule(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay;
        QuestsStore = findModule(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
        ChannelStore = findModule(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A;
        GuildChannelStore = findModule(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay;
        FluxDispatcher = findModule(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h;
        api = findModule(x => x?.exports?.Bo?.get && x?.exports?.Bo?.post)?.exports?.Bo;

        // 2. If not found, fallback to previous structures (Z/ZP/tn + __proto__)
        if (!ApplicationStreamingStore || !RunningGameStore || !QuestsStore || !ChannelStore || !GuildChannelStore || !FluxDispatcher || !api) {
            logger.info("New selectors incomplete, trying fallbacks...");

            if (!ApplicationStreamingStore) ApplicationStreamingStore = findModule(x => x?.exports?.Z?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.Z;
            if (!RunningGameStore) RunningGameStore = findModule(x => x?.exports?.ZP?.getRunningGames)?.exports?.ZP;
            if (!QuestsStore) QuestsStore = findModule(x => x?.exports?.Z?.__proto__?.getQuest)?.exports?.Z;
            if (!ChannelStore) ChannelStore = findModule(x => x?.exports?.Z?.__proto__?.getAllThreadsForParent)?.exports?.Z;
            if (!GuildChannelStore) GuildChannelStore = findModule(x => x?.exports?.ZP?.getSFWDefaultChannel)?.exports?.ZP;
            if (!FluxDispatcher) FluxDispatcher = findModule(x => x?.exports?.Z?.__proto__?.flushWaitQueue)?.exports?.Z;
            if (!api) api = findModule(x => x?.exports?.tn?.get && x?.exports?.tn?.post)?.exports?.tn;
        }

        // 3. Generic export scan fallback in case Discord rotated export names
        const findExport = (predicate) => {
            for (const m of modules) {
                if (!m?.exports || (typeof m.exports !== "object" && typeof m.exports !== "function")) continue;
                let vals;
                try {
                    vals = Object.values(m.exports);
                } catch {
                    continue;
                }
                for (const val of vals) {
                    try {
                        if (val && predicate(val)) return val;
                    } catch {
                        // ignore getter errors
                    }
                }
            }
            return null;
        };

        const hasMethod = (obj, method) => Boolean(obj?.__proto__?.[method] || obj?.[method]);

        if (!ApplicationStreamingStore) ApplicationStreamingStore = findExport(v => hasMethod(v, "getStreamerActiveStreamMetadata"));
        if (!RunningGameStore) RunningGameStore = findExport(v => typeof v.getRunningGames === "function" && typeof v.getGameForPID === "function");
        if (!QuestsStore) QuestsStore = findExport(v => hasMethod(v, "getQuest") && v.quests instanceof Map);
        if (!ChannelStore) ChannelStore = findExport(v => hasMethod(v, "getAllThreadsForParent") && typeof v.getSortedPrivateChannels === "function");
        if (!GuildChannelStore) GuildChannelStore = findExport(v => typeof v.getSFWDefaultChannel === "function" && typeof v.getAllGuilds === "function");
        if (!FluxDispatcher) FluxDispatcher = findExport(v => hasMethod(v, "flushWaitQueue") && typeof v.dispatch === "function");
        if (!api) api = findExport(v => typeof v.get === "function" && typeof v.post === "function" && typeof v.put === "function" && typeof v.del === "function");

        if (!QuestsStore || !api) {
            throw new Error("Critical modules (QuestsStore or api) could not be found.");
        }

        logger.success("Internal Discord modules loaded successfully.");
    } catch (e) {
        logger.warn("Failed to load modules. Discord might have updated their internal structure.");
        console.error(e);
        return;
    }

    // ============================================================================
    // QUEST LOGIC & CONFIGURATION
    // ============================================================================

    const supportedTasks = ["WATCH_VIDEO", "PLAY_ON_DESKTOP", "STREAM_ON_DESKTOP", "PLAY_ACTIVITY", "WATCH_VIDEO_ON_MOBILE"];

    // Retrieve and filter active quests from the QuestsStore
    // Criteria: Enrolled, Not Completed, Not Expired, Supported Task Type
    const quests = [...QuestsStore.quests.values()].filter(x => {
        const tasks = (x?.config?.taskConfig ?? x?.config?.taskConfigV2)?.tasks;
        return x?.userStatus?.enrolledAt &&
            !x?.userStatus?.completedAt &&
            new Date(x?.config?.expiresAt).getTime() > Date.now() &&
            tasks &&
            supportedTasks.some(y => Object.keys(tasks).includes(y));
    });

    // Check if running in Native App (Desktop) or Browser
    const isApp = typeof DiscordNative !== "undefined";

    if (quests.length === 0) {
        logger.info("No active, uncompleted quests found. Please check your Gift Inventory settings.");
        return;
    }

    logger.log(`Starting processing for ${quests.length} quest(s)...`, "yellow");

    /**
     * Recursive function to process quests one by one.
     */
    const doJob = function () {
        const quest = quests.pop(); // Process LIFO

        // Base case: No more quests
        if (!quest) {
            logger.success("All jobs completed!");
            return;
        }

        // Generate a random Process ID (PID) to simulate a real application
        const pid = Math.floor(Math.random() * 30000) + 1000;

        // Extract Quest Metadata safely (application can be undefined for video/non-game quests)
        const applicationId = quest.config?.application?.id;
        const applicationName = quest.config?.application?.name ?? quest.config?.messages?.gameTitle ?? "N/A";
        const questName = quest.config?.messages?.questName ?? applicationName;
        const taskConfig = quest.config?.taskConfig ?? quest.config?.taskConfigV2;
        const taskName = supportedTasks.find(x => taskConfig?.tasks?.[x] != null);

        if (!taskName) {
            logger.warn(`No supported task found for "${questName}". Skipping...`);
            doJob();
            return;
        }

        const secondsNeeded = taskConfig.tasks[taskName].target;
        let secondsDone = quest.userStatus?.progress?.[taskName]?.value ?? 0;

        logger.log(`Starting Quest: ${questName}`, "white");
        logger.info(`Type: ${taskName} | App: ${applicationName} | Target: ${secondsNeeded} seconds`);

        // --------------------------------------------------------------------
        // HANDLER: WATCH_VIDEO / WATCH_VIDEO_ON_MOBILE
        // --------------------------------------------------------------------
        if (taskName === "WATCH_VIDEO" || taskName === "WATCH_VIDEO_ON_MOBILE") {
            const maxFuture = 10; // Allow slight future timestamps
            const speed = 7;      // Seconds to increment per loop
            const interval = 1;   // Loop delay
            const enrolledAt = new Date(quest.userStatus.enrolledAt).getTime();
            let completed = false;

            const fn = async () => {
                logger.info("Spoofing video playback...");

                try {
                    while (true) {
                        // Calculate server-side logic validation boundaries
                        const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + maxFuture;
                        const diff = maxAllowed - secondsDone;
                        const timestamp = secondsDone + speed;

                        // Only send update if we are within allowed time boundaries
                        if (diff >= speed) {
                            const res = await api.post({
                                url: `/quests/${quest.id}/video-progress`,
                                body: { timestamp: Math.min(secondsNeeded, timestamp + Math.random()) }
                            });

                            completed = res?.body?.completed_at != null;
                            secondsDone = Math.min(secondsNeeded, timestamp);
                            logger.bar(secondsDone, secondsNeeded);
                        }

                        if (secondsDone >= secondsNeeded || completed) {
                            break;
                        }

                        // Wait before next heartbeat
                        await new Promise(resolve => setTimeout(resolve, interval * 1000));
                    }

                    // Finalize completion if server hasn't confirmed yet
                    if (!completed) {
                        await api.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: secondsNeeded } });
                        logger.bar(secondsNeeded, secondsNeeded);
                    }

                    logger.success(`${questName} completed!`);
                } catch (err) {
                    logger.warn(`Failed while processing video quest "${questName}". Skipping to next quest...`);
                    console.error(err);
                }

                doJob(); // Next quest
            };
            fn();

        // --------------------------------------------------------------------
        // HANDLER: PLAY_ON_DESKTOP (Game Mocking)
        // --------------------------------------------------------------------
        } else if (taskName === "PLAY_ON_DESKTOP") {
            if (!isApp) {
                logger.warn(`Skipping "${questName}": PLAY_ON_DESKTOP requires the Discord Desktop App.`);
                doJob();
            } else if (!applicationId || !RunningGameStore || !FluxDispatcher) {
                logger.warn(`Skipping "${questName}": Missing application ID or required Discord stores.`);
                doJob();
            } else {
                // Fetch public application data to get accurate executable names
                api.get({ url: `/applications/public?application_ids=${applicationId}` }).then(res => {
                    const appData = res?.body?.[0];
                    if (!appData) {
                        logger.warn(`Skipping "${questName}": Could not fetch application metadata.`);
                        doJob();
                        return;
                    }

                    const appDisplayName = appData.name ?? applicationName;
                    const exeName = appData.executables?.find(x => x.os === "win32")?.name?.replace(">", "")
                        ?? appData.executables?.[0]?.name?.replace(">", "")
                        ?? appDisplayName.replace(/[\/\\:*?"<>|]/g, "");

                    // Construct a fake game process object
                    const fakeGame = {
                        cmdLine: `C:\\Program Files\\${appDisplayName}\\${exeName}`,
                        exeName,
                        exePath: `c:/program files/${appDisplayName.toLowerCase()}/${exeName}`,
                        hidden: false,
                        isLauncher: false,
                        id: applicationId,
                        name: appDisplayName,
                        pid: pid,
                        pidPath: [pid],
                        processName: appDisplayName,
                        start: Date.now(),
                    };

                    // Backup original store functions
                    const realGames = RunningGameStore.getRunningGames();
                    const fakeGames = [fakeGame];
                    const realGetRunningGames = RunningGameStore.getRunningGames;
                    const realGetGameForPID = RunningGameStore.getGameForPID;

                    // OVERRIDE: Inject our fake game into the Store
                    RunningGameStore.getRunningGames = () => fakeGames;
                    RunningGameStore.getGameForPID = (targetPid) => fakeGames.find(x => x.pid === targetPid);

                    // Notify Discord internals that a game "started"
                    FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: realGames, added: [fakeGame], games: fakeGames });

                    logger.info(`Simulating game: ${appDisplayName}`);
                    logger.info(`Estimated wait time: ${Math.ceil(Math.max(0, secondsNeeded - secondsDone) / 60)} minutes.`);

                    // Listener for heartbeat success (progress updates)
                    const fn = data => {
                        if (data?.questId != null && data.questId !== quest.id) return;

                        const rawProgress = quest.config?.configVersion === 1
                            ? data?.userStatus?.streamProgressSeconds
                            : data?.userStatus?.progress?.PLAY_ON_DESKTOP?.value;

                        if (rawProgress == null) return;
                        const progress = Math.floor(rawProgress);

                        logger.bar(progress, secondsNeeded);

                        if (progress >= secondsNeeded) {
                            logger.success(`${questName} completed!`);

                            // RESTORE: Cleanup and reset Store functions to original state
                            RunningGameStore.getRunningGames = realGetRunningGames;
                            RunningGameStore.getGameForPID = realGetGameForPID;
                            FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: realGames });
                            FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);

                            doJob(); // Next quest
                        }
                    };

                    // Subscribe to the heartbeat event
                    FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                }).catch(err => {
                    logger.warn(`Failed while starting PLAY_ON_DESKTOP quest "${questName}". Skipping...`);
                    console.error(err);
                    doJob();
                });
            }

        // --------------------------------------------------------------------
        // HANDLER: STREAM_ON_DESKTOP
        // --------------------------------------------------------------------
        } else if (taskName === "STREAM_ON_DESKTOP") {
            if (!isApp) {
                logger.warn(`Skipping "${questName}": Streaming quests require the Discord Desktop App.`);
                doJob();
            } else if (!applicationId || !ApplicationStreamingStore || !FluxDispatcher) {
                logger.warn(`Skipping "${questName}": Missing application ID or required Discord stores.`);
                doJob();
            } else {
                // Mock the Streamer Store to pretend we are streaming the specific App ID
                const realFunc = ApplicationStreamingStore.getStreamerActiveStreamMetadata;
                ApplicationStreamingStore.getStreamerActiveStreamMetadata = () => ({
                    id: applicationId,
                    pid,
                    sourceName: null
                });

                logger.info(`Simulating stream for ${applicationName}`);
                logger.info(`Requirement: You must be in a VC and streaming any window!`);
                logger.warn("NOTE: At least one other person or bot must be in the VC.");

                const fn = data => {
                    if (data?.questId != null && data.questId !== quest.id) return;

                    const rawProgress = quest.config?.configVersion === 1
                        ? data?.userStatus?.streamProgressSeconds
                        : data?.userStatus?.progress?.STREAM_ON_DESKTOP?.value;

                    if (rawProgress == null) return;
                    const progress = Math.floor(rawProgress);

                    logger.bar(progress, secondsNeeded);

                    if (progress >= secondsNeeded) {
                        logger.success(`${questName} completed!`);

                        // Restore original function
                        ApplicationStreamingStore.getStreamerActiveStreamMetadata = realFunc;
                        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
                        doJob();
                    }
                };
                FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", fn);
            }

        // --------------------------------------------------------------------
        // HANDLER: PLAY_ACTIVITY (Embedded Activities)
        // --------------------------------------------------------------------
        } else if (taskName === "PLAY_ACTIVITY") {
            // Find a valid channel (Private channel or first Guild Voice Channel)
            const channelId = ChannelStore?.getSortedPrivateChannels?.()?.[0]?.id
                ?? Object.values(GuildChannelStore?.getAllGuilds?.() ?? {}).find(x => x != null && x.VOCAL?.length > 0)?.VOCAL?.[0]?.channel?.id;

            if (!channelId) {
                logger.warn(`Skipping "${questName}": No valid DM or Voice Channel found for PLAY_ACTIVITY.`);
                doJob();
                return;
            }

            const streamKey = `call:${channelId}:1`;

            const fn = async () => {
                logger.info(`Starting Activity in Channel ID: ${channelId}...`);

                try {
                    while (true) {
                        // Send manual heartbeat to the API
                        const res = await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: false } });
                        const progress = res?.body?.progress?.PLAY_ACTIVITY?.value ?? secondsDone;
                        logger.bar(progress, secondsNeeded);

                        if (progress >= secondsNeeded) {
                            // Send terminal heartbeat to finish
                            await api.post({ url: `/quests/${quest.id}/heartbeat`, body: { stream_key: streamKey, terminal: true } });
                            break;
                        }

                        // Wait 20 seconds between heartbeats (Discord standard)
                        await new Promise(resolve => setTimeout(resolve, 20 * 1000));
                    }

                    logger.success(`${questName} completed!`);
                } catch (err) {
                    logger.warn(`Failed while processing PLAY_ACTIVITY quest "${questName}". Skipping to next quest...`);
                    console.error(err);
                }

                doJob();
            };
            fn();
        }
    };

    // Kick off the loop
    doJob();
})();
