import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type UIState = {
  theme: string;
  darkMode: boolean;
  darkVariant: string;
  sidebarOpen: boolean;
};

const read = (): UIState => {
  const fallback: UIState = { theme: "sky", darkMode: false, darkVariant: "default", sidebarOpen: false };
  try {
    const raw = localStorage.getItem("mnr_settings");
    if (!raw) return fallback;
    const p = JSON.parse(raw);
    return {
      theme: p.theme || fallback.theme,
      darkMode: !!p.darkMode,
      darkVariant: p.darkVariant || fallback.darkVariant,
      sidebarOpen: false,
    };
  } catch {
    return fallback;
  }
};

const uiSlice = createSlice({
  name: "ui",
  initialState: read(),
  reducers: {
    setTheme(state, action: PayloadAction<string>) { state.theme = action.payload; },
    setDarkMode(state, action: PayloadAction<boolean>) { state.darkMode = action.payload; },
    setDarkVariant(state, action: PayloadAction<string>) { state.darkVariant = action.payload; },
    setSidebarOpen(state, action: PayloadAction<boolean>) { state.sidebarOpen = action.payload; },
  },
});

export const { setTheme, setDarkMode, setDarkVariant, setSidebarOpen } = uiSlice.actions;
export default uiSlice.reducer;