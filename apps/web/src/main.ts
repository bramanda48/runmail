import { createPinia } from "pinia";
import { createApp } from "vue";
import "./styles/globals.css";
import "./icons";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);

app.use(createPinia());
// Session restore is handled lazily by the router guard (no eager restore here).
app.use(router);

app.mount("#app");
