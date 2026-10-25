import DataUseDocument from "../components/information/DataUseDocument.jsx";
import EmbeddedInformationShell, {
  EmbeddedInformationRelatedLinks,
} from "../components/information/EmbeddedInformationShell.jsx";

export { meta } from "./data-use.jsx";

export default function EmbeddedDataUsePage() {
  return (
    <DataUseDocument
      Shell={EmbeddedInformationShell}
      RelatedLinks={EmbeddedInformationRelatedLinks}
    />
  );
}
