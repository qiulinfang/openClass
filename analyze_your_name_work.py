import re
from datetime import datetime
from collections import defaultdict, Counter

def analyze_your_name_work():
    # 读取Your Name的提交记录
    commits = []

    # 尝试多种编码方式读取文件
    encodings = ['utf-8', 'gbk', 'gb2312', 'utf-16', 'latin1']
    content = None

    for encoding in encodings:
        try:
            with open('your_name_commits.txt', 'r', encoding=encoding) as f:
                content = f.read()
                break
        except UnicodeDecodeError:
            continue

    if content is None:
        print("无法读取文件内容")
        return commits

    # 处理内容
    lines = content.split('\n')
    for line in lines:
        if line.strip():
            parts = line.strip().split('|', 4)
            if len(parts) >= 5:
                commit_hash, author, email, date_str, message = parts
                try:
                    # 解析日期
                    date = datetime.fromisoformat(date_str.replace(' +0800', '+08:00'))
                    commits.append({
                        'hash': commit_hash,
                        'author': author,
                        'email': email,
                        'date': date,
                        'message': message,
                        'year': date.year,
                        'month': date.month,
                        'day': date.day,
                        'weekday': date.weekday()
                    })
                except:
                    continue

    print(f"Your Name总提交数: {len(commits)}")

    # 按年份和月份统计
    yearly_stats = defaultdict(int)
    monthly_stats = defaultdict(int)
    commit_types = Counter()
    weekdays = Counter()

    for commit in commits:
        yearly_stats[commit['year']] += 1
        monthly_stats[f"{commit['year']}-{commit['month']:02d}"] += 1
        weekdays[commit['weekday']] += 1

        # 分析提交类型
        msg = commit['message'].lower()
        if any(keyword in msg for keyword in ['feat:', 'feature:', '新增', '实现', '完成', '添加']):
            commit_types['feature'] += 1
        elif any(keyword in msg for keyword in ['bugfix:', 'fix:', '修复', '修正', '解决']):
            commit_types['bugfix'] += 1
        elif any(keyword in msg for keyword in ['docs:', '文档', 'readme']):
            commit_types['docs'] += 1
        elif any(keyword in msg for keyword in ['refactor:', '重构', '优化', '改进']):
            commit_types['refactor'] += 1
        elif any(keyword in msg for keyword in ['style:', '样式', 'ui', '界面']):
            commit_types['style'] += 1
        elif any(keyword in msg for keyword in ['test:', '测试']):
            commit_types['test'] += 1
        elif 'pro' in msg or 'release' in msg or '版本' in msg:
            commit_types['release'] += 1
        elif 'merge' in msg.lower():
            commit_types['merge'] += 1
        else:
            commit_types['other'] += 1

    # 分析主要功能开发
    features = []
    for commit in commits:
        msg = commit['message']
        if any(keyword in msg for keyword in ['feat:', 'feature:', '新增', '实现', '完成', '添加', '优化', '改进']):
            features.append((commit['date'], msg))

    # 分析版本发布
    versions = []
    for commit in commits:
        msg = commit['message']
        if any(keyword in msg for keyword in ['pro', 'release', '版本']) and any(char.isdigit() for char in msg):
            versions.append((commit['date'], msg))

    # 生成个人年终报告
    report = generate_personal_report(commits, yearly_stats, commit_types, weekdays, monthly_stats, features, versions)
    return report

def generate_personal_report(commits, yearly_stats, commit_types, weekdays, monthly_stats, features, versions):
    # 计算总工作量
    total_commits = len(commits)
    total_days = len(set(commit['date'].date() for commit in commits))

    report = f"""# Your Name 2025年度工作报告

**报告日期：2026年1月9日**

## 一、个人工作概况

作为研伴前端项目核心开发人员，我在2025年度深入参与了项目的各个重要阶段，为产品的持续优化和功能创新贡献了重要力量。

### 工作量统计
- **总提交次数**：{total_commits} 次
- **实际工作日**：{total_days} 天
- **平均每日提交**：{total_commits/total_days:.1f} 次
- **工作周期**：{min(c['year'] for c in commits)}年 - {max(c['year'] for c in commits)}年

## 二、工作内容分析

### 2.1 年度贡献分布
"""

    # 添加年度统计
    for year in sorted(yearly_stats.keys()):
        report += f"#### {year}年度\n"
        report += f"- 提交次数: {yearly_stats[year]}\n"
        report += f"- 平均每月提交: {yearly_stats[year]/12:.1f}\n\n"

    # 工作类型分布
    report += "### 2.2 工作类型分布\n\n"
    total = sum(commit_types.values())
    report += "| 工作类型 | 数量 | 占比 | 说明 |\n"
    report += "|----------|------|------|------|\n"

    type_descriptions = {
        'feature': '新功能开发',
        'bugfix': '问题修复',
        'refactor': '代码优化',
        'release': '版本发布',
        'merge': '分支合并',
        'docs': '文档编写',
        'style': '界面优化',
        'test': '测试相关',
        'other': '其他工作'
    }

    for commit_type, count in commit_types.most_common():
        percentage = (count / total) * 100
        description = type_descriptions.get(commit_type, commit_type)
        report += f"| {description} | {count} | {percentage:.1f}% | - |\n"

    # 工作效率分析
    report += "\n### 2.3 工作效率分析\n\n"
    report += "#### 工作日分布\n"
    weekday_names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    for i in range(7):
        count = weekdays.get(i, 0)
        percentage = (count / total) * 100 if total > 0 else 0
        report += f"- {weekday_names[i]}: {count} 次 ({percentage:.1f}%)\n"

    report += "\n#### 月度工作量趋势\n\n"
    report += "| 月份 | 提交数 | 工作日数 | 日均效率 |\n"
    report += "|------|--------|----------|----------|\n"

    # 计算每月工作日数
    monthly_days = defaultdict(set)
    for commit in commits:
        monthly_days[f"{commit['year']}-{commit['month']:02d}"].add(commit['date'].date())

    for month in sorted(monthly_stats.keys()):
        commits_count = monthly_stats[month]
        days_count = len(monthly_days[month])
        daily_avg = commits_count / days_count if days_count > 0 else 0
        report += f"| {month} | {commits_count} | {days_count} | {daily_avg:.1f} |\n"

    # 主要成就
    report += "\n## 三、主要工作成就\n\n"

    # 功能开发成就
    if features:
        report += "### 3.1 功能开发成果\n\n"
        report += f"共完成 **{len(features)}** 项功能开发工作，主要包括：\n\n"

        # 按时间倒序显示最近的功能
        recent_features = sorted(features, key=lambda x: x[0], reverse=True)[:15]
        for date, feature in recent_features:
            date_str = date.strftime('%Y-%m-%d')
            report += f"- **{date_str}**: {feature}\n"
        report += "\n"

    # 版本发布成就
    if versions:
        report += "### 3.2 版本发布贡献\n\n"
        report += f"参与 **{len(versions)}** 次版本发布工作：\n\n"
        for date, version in sorted(versions, key=lambda x: x[0], reverse=True):
            date_str = date.strftime('%Y-%m-%d')
            report += f"- **{date_str}**: {version}\n"
        report += "\n"

    # 技术优化成就
    refactor_count = commit_types.get('refactor', 0) + commit_types.get('bugfix', 0)
    if refactor_count > 0:
        report += "### 3.3 技术优化贡献\n\n"
        report += f"完成 **{refactor_count}** 次技术优化和问题修复工作，显著提升了系统的稳定性和性能。\n\n"

    # 工作亮点
    report += "## 四、工作亮点与特点\n\n"

    # 计算工作连续性
    work_streak = calculate_work_streak(commits)
    report += f"### 4.1 工作连续性\n"
    report += f"- 最长连续工作天数: **{work_streak['max_streak']}** 天\n"
    report += f"- 平均工作间隔: **{work_streak['avg_gap']:.1f}** 天\n\n"

    report += "### 4.2 工作效率特点\n"
    high_productivity_months = [month for month, count in monthly_stats.items() if count >= 20]
    if high_productivity_months:
        report += f"- 高产月份: {', '.join(high_productivity_months)}\n"
    report += f"- 工作稳定性: 全年工作日覆盖率 **{(total_days/365*100):.1f}%**\n\n"

    # 专业能力体现
    report += "### 4.3 专业能力体现\n"
    report += "- **技术深度**: 熟练掌握Vue.js、Android原生开发等技术栈\n"
    report += "- **问题解决**: 快速定位并修复系统问题，提升用户体验\n"
    report += "- **创新能力**: 主动提出功能优化方案，推动产品改进\n"
    report += "- **质量意识**: 重视代码质量和系统稳定性\n\n"

    # 2026年工作计划
    report += "## 五、2026年工作展望\n\n"

    report += "### 5.1 技术发展方向\n"
    report += "- 深化AI功能开发，提升智能学习体验\n"
    report += "- 优化移动端性能，改善用户交互体验\n"
    report += "- 加强跨平台一致性，提升产品整体质量\n\n"

    report += "### 5.2 能力提升计划\n"
    report += "- 学习新技术栈，提升技术前瞻性\n"
    report += "- 加强项目管理能力，提升团队协作效率\n"
    report += "- 深入理解业务需求，提升产品设计能力\n\n"

    # 自我评价
    report += "## 六、自我评价与总结\n\n"

    report += "2025年度，我在研伴前端项目中发挥了重要作用，不仅完成了大量的功能开发和优化工作，更重要的是通过持续的改进提升了产品的竞争力和用户满意度。面对项目需求的变化和技术挑战，我始终保持学习的态度和创新的精神，为团队的发展和产品的成功做出了积极贡献。\n\n"

    report += "在未来的工作中，我将继续保持高标准、严要求的工作态度，致力于成为更优秀的技术专家和团队贡献者。\n\n"

    # 致谢
    report += "## 七、致谢\n\n"

    report += "感谢公司领导对我的信任和支持，感谢团队成员的配合与帮助，感谢所有用户的宝贵反馈。正是这些支持和鼓励，让我在2025年度的工作中不断进步、不断突破。\n\n"

    report += "---\n\n"
    report += f"**Your Name**\n\n"
    report += f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n"
    report += "*数据来源: Git提交记录分析*\n"

    return report

def calculate_work_streak(commits):
    """计算工作连续性"""
    if not commits:
        return {'max_streak': 0, 'avg_gap': 0}

    # 按日期排序
    dates = sorted(set(commit['date'].date() for commit in commits))
    dates.sort()

    # 计算最长连续工作天数
    max_streak = 1
    current_streak = 1

    for i in range(1, len(dates)):
        if (dates[i] - dates[i-1]).days == 1:
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 1

    # 计算平均工作间隔
    if len(dates) > 1:
        total_gaps = sum((dates[i] - dates[i-1]).days - 1 for i in range(1, len(dates)))
        avg_gap = total_gaps / (len(dates) - 1)
    else:
        avg_gap = 0

    return {'max_streak': max_streak, 'avg_gap': avg_gap}

if __name__ == "__main__":
    report = analyze_your_name_work()
    with open('Your_Name_年终报告.md', 'w', encoding='utf-8') as f:
        f.write(report)
    print("\nYour Name的年终报告已生成: Your_Name_年终报告.md")
