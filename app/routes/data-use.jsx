import DataUseDocument from "../components/information/DataUseDocument.jsx";
import { publicInfo } from "../config/public-info";

export const meta = () => [{ title: `Data Use | ${publicInfo.appName}` }];

export default function DataUsePage() {
  return <DataUseDocument />;
}
