import { QuartzFilterPlugin } from "../types"
import { isAttachmentPath } from "../../util/path"

export const HideAttachmentFiles: QuartzFilterPlugin = () => ({
  name: "HideAttachmentFiles",
  shouldPublish(_ctx, [_tree, vfile]) {
    const slug = vfile.data?.slug
    if (!slug) return true

    return !isAttachmentPath(slug)
  },
})