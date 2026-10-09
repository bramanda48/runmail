import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "./icons";
import router from "./router";
import "./styles/globals.css";

const app = createApp(App);

app.use(createPinia());
// Session restore is handled lazily by the router guard (no eager restore here).
app.use(router);

app.mount("#app");
