type TabState = {
    index: number;
    routes: readonly { name: string; state?: { index?: number } }[];
};

export function createTabListener(navigation: { getState(): TabState }, route: { name: string }) {
    return {
        tabPress(event: { preventDefault(): void }) {
            const state = navigation.getState();
            const current = state.routes[state.index];
            // Preserve the current root-press behavior, including the screen's
            // own handlers for clearing Search or selecting Library's first tab.
            if (current?.name === route.name && (!current.state || current.state.index === 0)) event.preventDefault();
            // All other presses use the tab/native-stack routers, preserving keys.
        },
    };
}
