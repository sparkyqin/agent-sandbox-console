import { Activity, Cpu, DollarSign, Gauge, Loader2, ShieldAlert } from 'lucide-react'
import { Card, ProgressBar, QuotaBar, SectionTitle } from '../../components/ui'
import { useCost, useQuota } from '../../api/control'

export const CostDashboard = () => {
  const { data: cost, isLoading: costLoading } = useCost()
  const { data: quota } = useQuota()

  if (costLoading && !cost) {
    return <div className="py-16 flex items-center justify-center text-gray-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> 加载成本数据…</div>
  }
  if (!cost) {
    return <div className="py-16 text-center text-gray-400">无法加载成本数据</div>
  }

  const spentPct = cost.budgetMonthly ? Math.round((cost.spentMonth / cost.budgetMonthly) * 100) : 0
  const q = quota?.used
  const ql = quota?.limit

  return (
    <div className="space-y-4">
      {/* 预算概览 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle icon={<DollarSign className="w-5 h-5 text-blue-500" />} title="本月预算" />
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-gray-800">¥{cost.spentMonth.toFixed(2)}</span>
            <span className="text-sm text-gray-400 mb-1">/ ¥{cost.budgetMonthly}</span>
            <span className={`text-sm font-medium mb-1 ${spentPct > 80 ? 'text-red-600' : 'text-emerald-600'}`}>{spentPct}%</span>
          </div>
          <div className="mt-3"><ProgressBar value={spentPct} color={spentPct > 80 ? 'red' : 'emerald'} /></div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />50% 预警</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />80% 预警</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />100% 超限动作: 暂停新建</span>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle icon={<ShieldAlert className="w-5 h-5 text-amber-500" />} title="超限动作" />
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded" /><span className="text-gray-700">达 80% 邮件告警</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" defaultChecked className="rounded" /><span className="text-gray-700">达 100% 暂停新建</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" className="rounded" /><span className="text-gray-700">达 120% 强制休眠非 prod</span></label>
          </div>
        </Card>
      </div>

      {/* 配额 */}
      <Card className="p-5">
        <SectionTitle icon={<Gauge className="w-5 h-5 text-blue-500" />} title="资源配额使用" desc="按组织/项目维度限制并发、CPU、内存、存储与 GPU。创建时超限将被拦截。" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {q && ql ? (
            <>
              <QuotaBar label="实例数" used={q.instances} limit={ql.instances} unit="" />
              <QuotaBar label="CPU（核）" used={Math.round(q.cpu * 10) / 10} limit={ql.cpu} unit="" />
              <QuotaBar label="内存（MiB）" used={q.memory} limit={ql.memory} unit="" />
              <QuotaBar label="GPU（张）" used={q.gpu} limit={ql.gpu} unit="" />
              <QuotaBar label="存储（GB）" used={q.storage} limit={ql.storage} unit="" />
            </>
          ) : (
            <div className="text-sm text-gray-400 col-span-3">配额数据加载中…</div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 项目花费分布 */}
        <Card className="p-5">
          <SectionTitle icon={<Activity className="w-5 h-5 text-blue-500" />} title="按项目花费分布（本月）" />
          <div className="space-y-3">
            {cost.byProject.length === 0 ? (
              <div className="text-sm text-gray-400">暂无花费记录</div>
            ) : (
              cost.byProject.map((p) => {
                const pct = cost.spentMonth ? Math.round((p.amount / cost.spentMonth) * 100) : 0
                return (
                  <div key={p.project}>
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-700">{p.project}</span><span className="font-medium text-gray-800">¥{p.amount.toFixed(2)}</span></div>
                    <ProgressBar value={pct} />
                  </div>
                )
              })
            )}
          </div>
        </Card>
        {/* 单价表 */}
        <Card className="p-5">
          <SectionTitle icon={<Cpu className="w-5 h-5 text-blue-500" />} title="规格单价表" desc="按秒计费，不足 1 分钟按 1 分钟计。" />
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 border-b"><th className="text-left py-2 font-medium">规格</th><th className="text-left font-medium">配置</th><th className="text-right font-medium">单价</th></tr></thead>
            <tbody>
              {cost.priceTiers.map((t) => (
                <tr key={t.size} className="border-b border-gray-100"><td className="py-2.5 font-medium text-gray-700">{t.size}</td><td className="text-gray-500">{t.cpu}</td><td className="text-right text-blue-600 font-medium">{t.price}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
