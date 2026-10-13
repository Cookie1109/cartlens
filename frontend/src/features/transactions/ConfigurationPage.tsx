import { ArrowLeft } from "lucide-react"
import { useApp } from "../../app/AppProvider"
import { Button, ErrorBanner, PageHeading } from "../../components/ui"
import ReplayPanel from "./ReplayPanel"

export default function ConfigurationPage() {
  const { setPage, error, overview } = useApp()

  return (
    <>
      <PageHeading
        title="Cấu hình luồng"
        description="Thiết lập cách CartLens gom giao dịch và khai phá kết quả."
        action={
          <Button variant="secondary" onClick={() => setPage("transactions")}>
            <ArrowLeft size={16} />
            Quay lại Giao dịch
          </Button>
        }
      />
      <ErrorBanner message={error ?? overview?.miningError ?? null} />
      <ReplayPanel configurationOnly />
    </>
  )
}
