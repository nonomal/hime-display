import i18next from "i18next";
import resources from "./resources";
i18next.init({
  fallbackLng: "en",
  resources: resources,
});
export default i18next;