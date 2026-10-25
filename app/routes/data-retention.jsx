import DataRetentionDocument from "../components/information/DataRetentionDocument.jsx";
import { publicInfo } from "../config/public-info";

export const meta = () => [{ title: `Data Retention | ${publicInfo.appName}` }];

export default function DataRetentionPage() {
  return <DataRetentionDocument />;
}
