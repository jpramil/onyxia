import { Fragment, useMemo, memo } from "react";
import { tss } from "tss";
import { Button } from "onyxia-ui/Button";
import { Text } from "onyxia-ui/Text";
import { Icon } from "onyxia-ui/Icon";
import { IconButton } from "onyxia-ui/IconButton";
import { useTranslation } from "ui/i18n";
import { capitalize } from "tsafe/capitalize";
import { MyServicesRoundLogo } from "./MyServicesRoundLogo";
import { MyServicesRunningTime } from "./MyServicesRunningTime";
import { Tag } from "onyxia-ui/Tag";
import { Tooltip } from "onyxia-ui/Tooltip";
import { declareComponentKeys } from "i18nifty";
import { ReadmeDialog } from "./ReadmeDialog";
import { Evt, NonPostableEvt } from "evt";
import { useConst } from "powerhooks/useConst";
import { useEvt } from "evt/hooks";
import type { MuiIconComponentName } from "onyxia-ui/MuiIconComponentName";
import { id } from "tsafe/id";
import { CircularProgress } from "onyxia-ui/CircularProgress";
import type { Link } from "type-route";
import type { RunningService } from "core/usecases/serviceManagement/state";

const runningTimeThreshold = 7 * 24 * 3600 * 1000;

function getDoesHaveBeenRunningForTooLong(params: { startTime: number }): boolean {
    const { startTime } = params;

    return Date.now() - startTime > runningTimeThreshold;
}

export type Props = {
    className?: string;
    evtAction: NonPostableEvt<"open readme dialog">;
    onRequestDelete: () => void;
    onRequestPauseOrResume: () => void;
    getPoseInstallInstructions: () => string;
    myServiceLink: Link;
    lastClusterEvent:
        | { message: string; severity: "error" | "info" | "warning" }
        | undefined;
    onOpenClusterEventsDialog: () => void;
    projectServicePassword: string;
    runningService: RunningService;
};

export const MyServicesCard = memo((props: Props) => {
    const {
        className,
        evtAction,
        onRequestDelete,
        onRequestPauseOrResume,
        getPoseInstallInstructions,
        myServiceLink,
        lastClusterEvent,
        onOpenClusterEventsDialog,
        projectServicePassword,
        runningService
    } = props;

    const { t } = useTranslation({ MyServicesCard });

    const severity = useMemo(() => {
        if (runningService.status === "failed") {
            return "error";
        }

        if (
            runningService.status === "pending-install" ||
            !runningService.areAllTasksReady
        ) {
            return "pending";
        }

        return getDoesHaveBeenRunningForTooLong({ "startTime": runningService.startedAt })
            ? "warning"
            : "success";
    }, [runningService]);

    const { classes, cx, theme } = useStyles({
        "hasBeenRunningForTooLong": severity === "warning"
    });

    const evtOpenReadmeDialog = useConst(() => Evt.create());

    useEvt(
        ctx => {
            evtAction.attach(
                action => action === "open readme dialog",
                ctx,
                async () => {
                    if (!runningService.hasPostInstallInstructions) {
                        return;
                    }
                    evtOpenReadmeDialog.post();
                }
            );
        },
        [evtAction]
    );

    return (
        <div className={cx(classes.root, className)}>
            <a className={classes.aboveDivider} {...myServiceLink}>
                <MyServicesRoundLogo
                    url={runningService.chartIconUrl}
                    severity={severity}
                />
                <Text className={classes.title} typo="object heading">
                    {capitalize(runningService.friendlyName)}
                </Text>
                <div style={{ "flex": 1 }} />
                {runningService.pause.isPausable && !runningService.pause.isPaused && (
                    <Tooltip title={"Click to pause the service and release resources"}>
                        <IconButton
                            disabled={runningService.pause.isTransitioning}
                            icon={id<MuiIconComponentName>("Pause")}
                            onClick={event => {
                                onRequestPauseOrResume();
                                event.stopPropagation();
                                event.preventDefault();
                            }}
                        />
                    </Tooltip>
                )}
                {runningService.ownership.isShared && (
                    <Tooltip title={t("this is a shared service")}>
                        <Icon icon={id<MuiIconComponentName>("People")} />
                    </Tooltip>
                )}
                <Tooltip
                    title={
                        <Fragment key={"reminder"}>
                            {t("reminder to delete services")}
                        </Fragment>
                    }
                >
                    <Icon
                        icon={id<MuiIconComponentName>("ErrorOutline")}
                        className={classes.errorOutlineIcon}
                    />
                </Tooltip>
            </a>
            <div className={classes.belowDivider}>
                <div className={classes.belowDividerTop}>
                    <div>
                        <Text typo="caption" className={classes.captions}>
                            {t("service")}
                        </Text>
                        <div className={classes.packageNameWrapper}>
                            <Text typo="label 1">
                                {capitalize(runningService.chartName)}
                            </Text>
                            {runningService.ownership.isShared && (
                                <Tag
                                    className={classes.sharedTag}
                                    text={
                                        runningService.ownership.isOwned
                                            ? t("shared by you")
                                            : runningService.ownership.ownerUsername!
                                    }
                                />
                            )}
                        </div>
                    </div>
                    <div className={classes.timeAndStatusContainer}>
                        <Text typo="caption" className={classes.captions}>
                            {runningService.status === "deployed" &&
                            runningService.areAllTasksReady
                                ? t("running since")
                                : t("status")}
                        </Text>
                        {(() => {
                            switch (status) {
                                case "pending-install":
                                    return <Text typo="label 1">{t("pending")}</Text>;
                                case "failed":
                                    return <Text typo="label 1">{t("failed")}</Text>;
                                case "deployed":
                                    if (!runningService.areAllTasksReady) {
                                        return (
                                            <Text typo="label 1">
                                                {t("container starting")}
                                                &nbsp;
                                                <CircularProgress
                                                    className={classes.circularProgress}
                                                    size={
                                                        theme.typography.variants[
                                                            "label 1"
                                                        ].style.fontSize
                                                    }
                                                />
                                            </Text>
                                        );
                                    }
                                    return (
                                        <MyServicesRunningTime
                                            doesHaveBeenRunningForTooLong={getDoesHaveBeenRunningForTooLong(
                                                { "startTime": runningService.startedAt }
                                            )}
                                            startTime={runningService.startedAt}
                                        />
                                    );
                            }
                        })()}
                    </div>
                </div>
                <div className={classes.belowDividerBottom}>
                    {onRequestDelete !== undefined && (
                        <IconButton
                            icon={id<MuiIconComponentName>("Delete")}
                            onClick={onRequestDelete}
                        />
                    )}
                    <div style={{ "flex": 1 }} />

                    {runningService.pause.isPausable && runningService.pause.isPaused && (
                        <Tooltip title={"Click to resume the service"}>
                            <IconButton
                                disabled={runningService.pause.isTransitioning}
                                icon={id<MuiIconComponentName>("PlayArrow")}
                                onClick={onRequestPauseOrResume}
                            />
                        </Tooltip>
                    )}

                    {runningService.status === "deployed" &&
                        runningService.areAllTasksReady &&
                        (runningService.urls[0] !== undefined ||
                            runningService.hasPostInstallInstructions) && (
                            <Button
                                onClick={() => evtOpenReadmeDialog.post()}
                                variant={
                                    runningService.urls[0] === undefined
                                        ? "ternary"
                                        : "secondary"
                                }
                            >
                                <span>
                                    {runningService.urls[0] !== undefined
                                        ? capitalize(t("open"))
                                        : t("readme").toUpperCase()}
                                </span>
                            </Button>
                        )}
                </div>
            </div>
            <ReadmeDialog
                evtOpen={evtOpenReadmeDialog}
                getPostInstallInstructions={
                    runningService.hasPostInstallInstructions
                        ? getPoseInstallInstructions
                        : undefined
                }
                projectServicePassword={projectServicePassword}
                openUrl={runningService.urls[0]}
                isReady={
                    runningService.status === "deployed" &&
                    runningService.areAllTasksReady
                }
                lastClusterEvent={lastClusterEvent}
                onOpenClusterEventsDialog={onOpenClusterEventsDialog}
            />
        </div>
    );
});

const { i18n } = declareComponentKeys<
    | "service"
    | "running since"
    | "open"
    | "readme"
    | "shared by you"
    | "reminder to delete services"
    | "this is a shared service"
    | "status"
    | "container starting"
    | "pending"
    | "failed"
>()({ MyServicesCard });
export type I18n = typeof i18n;

const useStyles = tss
    .withParams<{
        hasBeenRunningForTooLong: boolean;
    }>()
    .withName({ MyServicesCard })
    .create(({ theme, hasBeenRunningForTooLong }) => ({
        "root": {
            "borderRadius": 8,
            "boxShadow": theme.shadows[1],
            "backgroundColor": theme.colors.useCases.surfaces.surface1,
            "&:hover": {
                "boxShadow": theme.shadows[6]
            },
            "display": "flex",
            "flexDirection": "column"
        },
        "aboveDivider": {
            "padding": theme.spacing({ "topBottom": 3, "rightLeft": 4 }),
            "borderBottom": `1px solid ${theme.colors.useCases.typography.textTertiary}`,
            "boxSizing": "border-box",
            "display": "flex",
            "alignItems": "center",
            "color": "inherit",
            "textDecoration": "none"
        },
        "title": {
            "marginLeft": theme.spacing(3)
        },
        "errorOutlineIcon": !hasBeenRunningForTooLong
            ? { "display": "none" }
            : {
                  "marginLeft": theme.spacing(3),
                  "color": theme.colors.useCases.alertSeverity.warning.main
              },
        "belowDivider": {
            "padding": theme.spacing(4),
            "paddingTop": theme.spacing(3),
            "flex": 1
        },
        "timeAndStatusContainer": {
            "flex": 1,
            "paddingLeft": theme.spacing(6)
        },
        "circularProgress": {
            "color": "inherit",
            "position": "relative",
            "top": 3,
            "left": theme.spacing(2)
        },
        "belowDividerTop": {
            "display": "flex",
            "marginBottom": theme.spacing(4)
        },
        "captions": {
            "display": "inline-block",
            "marginBottom": theme.spacing(2)
        },
        "packageNameWrapper": {
            "& > *": {
                "display": "inline-block"
            }
        },
        "sharedTag": {
            "marginLeft": theme.spacing(2)
        },
        "belowDividerBottom": {
            "display": "flex",
            "alignItems": "center"
        }
    }));
