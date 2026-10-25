import DataRetentionDocument from "../components/information/DataRetentionDocument.jsx";
import EmbeddedInformationShell, {
  EmbeddedInformationRelatedLinks,
} from "../components/information/EmbeddedInformationShell.jsx";

export { meta } from "./data-retention.jsx";

export default function EmbeddedDataRetentionPage() {
  return (
    <DataRetentionDocument
      Shell={EmbeddedInformationShell}
      RelatedLinks={EmbeddedInformationRelatedLinks}
    />
  );
}
