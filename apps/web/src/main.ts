import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { i18n } from "./i18n";
import "./icons";
import router from "./router";
import "./styles/globals.css";
import { initTheme } from "./themes";

const app = createApp(App);

initTheme();
app.use(createPinia());
app.use(i18n);
app.use(router);

app.mount("#app");
