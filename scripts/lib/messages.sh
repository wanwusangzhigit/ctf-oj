#!/usr/bin/env bash
# Bilingual message catalog and prompting helpers for the deploy scripts.
# shellcheck shell=bash

# Language precedence: --lang > CTF_OJ_LANG > LC_ALL/LANG > Chinese.
# An unset locale, or C/POSIX, counts as "not detected" and falls back to Chinese.
detect_lang() {
  local value
  for value in "${CTF_OJ_LANG:-}" "${LC_ALL:-}" "${LANG:-}"; do
    [[ -n "$value" ]] || continue
    case "$value" in
      [Cc] | [Cc].[Pp][Oo][Ss][Ii][Xx] | [Pp][Oo][Ss][Ii][Xx]) continue ;;
      zh*) printf 'zh'; return ;;
      en*) printf 'en'; return ;;
    esac
  done
  printf 'zh'
}

# t KEY [ARG...] — substitute @1@, @2@, ... ; prints [KEY] when the entry is missing.
t() {
  local name="msg_${1}_${LANG_CODE:-zh}"
  shift
  [[ -v "$name" ]] || { printf '[%s]' "${name#msg_}"; return 0; }
  local text="${!name}" arg index=1
  for arg in "$@"; do
    text="${text//@$index@/$arg}"
    index=$((index + 1))
  done
  printf '%s' "$text"
}

say() { printf '==> %s\n' "$(t "$@")"; }
warn() { printf '!! %s\n' "$(t "$@")" >&2; }
die() { warn "$@"; exit 1; }

# ask KEY DEFAULT — leaves the reply in $answer.
# Without a TTY, or with ASSUME_YES=1, the default is echoed and used as-is.
ask() {
  local key="$1" def="${2-}" input
  answer="$def"
  if [[ ! -t 0 || "${ASSUME_YES:-0}" -eq 1 ]]; then
    [[ -n "$def" ]] || die no_default "$key"
    printf '    %s [%s]\n' "$(t "$key")" "$def"
    return 0
  fi
  printf '    %s' "$(t "$key")"
  if [[ -n "$def" ]]; then
    printf ' [%s]' "$def"
  fi
  printf ': '
  IFS= read -r input || die read_aborted
  if [[ -n "$input" ]]; then
    answer="$input"
  fi
  return 0
}

# ask_options KEY DEFAULT "opt1 opt2" — accepts the token or its 1-based number.
ask_options() {
  local key="$1" def="$2" options="$3" choice reply
  local -a opts
  read -r -a opts <<<"$options"
  if [[ -t 0 && "${ASSUME_YES:-0}" -eq 0 ]]; then
    local i=1
    for choice in "${opts[@]}"; do
      printf '      %d) %s%s\n' "$i" "$choice" "$([[ "$choice" == "$def" ]] && printf '  <- %s' "$(t default_marker)")"
      i=$((i + 1))
    done
  fi
  while :; do
    ask "$key" "$def"
    reply="$answer"
    for choice in "${opts[@]}"; do
      [[ "$reply" == "$choice" ]] && { answer="$choice"; return 0; }
    done
    if [[ "$reply" =~ ^[0-9]+$ ]] && ((reply >= 1 && reply <= ${#opts[@]})); then
      answer="${opts[reply - 1]}"
      return 0
    fi
    [[ -t 0 && "${ASSUME_YES:-0}" -eq 0 ]] || die invalid_choice "$reply"
    warn invalid_choice "$reply"
  done
}

# ask_yes_no KEY DEFAULT — default is "yes" or "no"; leaves "yes"/"no" in $answer.
ask_yes_no() {
  local key="$1" def="${2:-no}" reply
  while :; do
    ask "$key" "$def"
    reply="$(printf '%s' "$answer" | tr '[:upper:]' '[:lower:]')"
    case "$reply" in
      y | yes | 是) answer=yes; return 0 ;;
      n | no | 否) answer=no; return 0 ;;
    esac
    [[ -t 0 && "${ASSUME_YES:-0}" -eq 0 ]] || die invalid_choice "$answer"
    warn invalid_choice "$answer"
  done
}

msg_no_default_zh='非交互模式没有可用的默认值：@1@'
msg_no_default_en='no default available for a non-interactive run: @1@'
msg_read_aborted_zh='输入被中断'
msg_read_aborted_en='input aborted'
msg_invalid_choice_zh='无法识别的选项：@1@（请直接输入列出的值）'
msg_invalid_choice_en='unrecognized option: @1@ (type one of the listed values)'
msg_default_marker_zh='默认'
msg_default_marker_en='default'

# ---------------------------------------------------------------- usage

msg_usage_head_zh='准备 CTF-OJ 部署。默认模式不提问：生成缺失的密钥、拉取镜像（拉不到则本地构建）、执行迁移、健康检查。'
msg_usage_head_en='Prepare a CTF-OJ deployment. The default mode asks nothing: it fills in missing secrets, pulls images (building locally when the pull fails), applies migrations and health-checks the result.'
msg_usage_options_zh='选项（自定义模式的每个问题都有对应参数）：'
msg_usage_options_en='Options (every wizard question has an equivalent flag):'
msg_usage_examples_intro_zh='示例：'
msg_usage_examples_intro_en='Examples:'

msg_flag_custom_zh='进入向导；不加则默认部署，全程零提问'
msg_flag_custom_en='run the interactive wizard; without it the default deployment asks nothing'
msg_flag_yes_zh='所有问题用默认值作答（配合 --custom 实现非交互自定义）'
msg_flag_yes_en='answer every question with its default (non-interactive custom deployment)'
msg_flag_lang_zh='输出语言；缺省时读 CTF_OJ_LANG 与 LC_ALL/LANG，检测不到则中文'
msg_flag_lang_en='output language; otherwise CTF_OJ_LANG and LC_ALL/LANG, falling back to Chinese'
msg_flag_source_zh='代码来源：pull 只拉镜像，build 只本地构建，auto 先拉取、失败再构建'
msg_flag_source_en='code source: pull only pulls, build only builds, auto pulls first and builds on failure'
msg_flag_pull_timeout_zh='拉取的时间上限（秒），0 表示不设时限；auto 到点即回退本地构建'
msg_flag_pull_timeout_en='pull deadline in seconds, 0 means no limit; auto falls back to a local build on expiry'
msg_flag_port_zh='对外 HTTP 端口'
msg_flag_port_en='public HTTP port'
msg_flag_project_zh='compose 项目名（决定卷与网络的前缀）'
msg_flag_project_en='compose project name (prefixes volumes and networks)'
msg_flag_registry_zh='镜像仓库前缀'
msg_flag_registry_en='image registry prefix'
msg_flag_tag_zh='镜像 tag'
msg_flag_tag_en='image tag'
msg_flag_register_zh='是否开放注册'
msg_flag_register_en='whether registration stays open'
msg_flag_instance_host_zh='选手访问容器实例的公网地址'
msg_flag_instance_host_en='public host players reach challenge instances on'
msg_flag_instance_ports_zh='实例端口区间'
msg_flag_instance_ports_en='instance port range'
msg_flag_secrets_zh='auto 自动生成占位密钥；manual 保留现有值（脚本从不读取密码）'
msg_flag_secrets_en='auto generates placeholder secrets; manual keeps them (the script never reads passwords)'
msg_flag_admin_zh='在总结的 SQL 里替换 YOUR_NAME，仅打印不执行'
msg_flag_admin_en='substitute YOUR_NAME in the printed SQL; printing only, never executed'
msg_flag_env_file_zh='环境变量文件路径'
msg_flag_env_file_en='env file to read and update'
msg_flag_dry_run_zh='只打印将执行的命令，不改文件、不起容器'
msg_flag_dry_run_en='print the commands instead of running them; touches no file and starts no container'
msg_flag_no_build_zh='等价 --source pull：绝不构建'
msg_flag_no_build_en='equivalent to --source pull: never build'
msg_flag_skip_migrate_zh='跳过数据库迁移'
msg_flag_skip_migrate_en='skip database migrations'
msg_flag_help_zh='显示本帮助'
msg_flag_help_en='show this help'

# ---------------------------------------------------------------- preflight

msg_unknown_option_zh='未知选项：@1@（--help 查看可用选项）'
msg_unknown_option_en='unknown option: @1@ (--help lists the options)'
msg_option_value_zh='选项 @1@ 缺少取值'
msg_option_value_en='option @1@ is missing its value'
msg_bad_lang_zh='无法识别的语言：@1@（只支持 zh 或 en）'
msg_bad_lang_en='unrecognized language: @1@ (only zh or en is supported)'
msg_docker_missing_zh='需要 docker，但未找到'
msg_docker_missing_en='docker is required but was not found'
msg_compose_missing_zh='需要 docker compose v2，但未找到'
msg_compose_missing_en='docker compose v2 is required but was not found'
msg_env_creating_zh='从 .env.example 创建 @1@'
msg_env_creating_en='creating @1@ from .env.example'
msg_wizard_no_tty_zh='自定义向导需要终端；非交互环境请直接用参数（--custom --yes 或逐项 --port/--project/...），参见 --help'
msg_wizard_no_tty_en='the custom wizard needs a terminal; in a non-interactive environment pass flags instead (--custom --yes, or --port/--project/... per option), see --help'
msg_dry_run_notice_zh='dry-run：只展示命令，不修改文件、不启动容器'
msg_dry_run_notice_en='dry run: showing commands only, no file changes and no containers started'

# ---------------------------------------------------------------- wizard

msg_wizard_head_zh='自定义部署向导（回车即采用方括号里的默认值）'
msg_wizard_head_en='Custom deployment wizard (press Enter to keep the bracketed default)'
msg_wizard_note_zh='所有答案都会写进环境变量文件，并且都有等价的命令行参数。'
msg_wizard_note_en='Every answer is written to the env file and has an equivalent command-line flag.'
msg_group_one_zh='[1/4] 访问与代码来源'
msg_group_one_en='[1/4] access and code source'
msg_group_two_zh='[2/4] 镜像与实例'
msg_group_two_en='[2/4] images and instances'
msg_group_three_zh='[3/4] 密钥'
msg_group_three_en='[3/4] secrets'
msg_group_four_zh='[4/4] 第一个管理员'
msg_group_four_en='[4/4] first administrator'
msg_ask_port_zh='对外 HTTP 端口'
msg_ask_port_en='public HTTP port'
msg_ask_project_zh='compose 项目名'
msg_ask_project_en='compose project name'
msg_project_warning_zh='卷与网络按项目名隔离：改用 @1@ 后，旧项目里的数据库与卷数据不会自动迁移过来'
msg_project_warning_en='volumes and networks are namespaced by project name: switching to @1@ will not carry over data from the previous project'
msg_env_file_default_project_zh='@1@ 里的项目名仍是 @2@：这次运行（包括后续的 docker compose down -v）会打在名为 @2@ 的现有部署上，而不是隔离开来。要真隔离请显式传 --project NAME'
msg_env_file_default_project_en='@1@ still names the project @2@: this run — and any later docker compose down -v against it — acts on the existing @2@ deployment instead of staying isolated. Pass --project NAME to actually separate them'
msg_port_busy_zh='端口 @1@ 已被另一个 compose 项目发布，启动会失败；请释放该端口或改用其他端口'
msg_port_busy_en='another compose project already publishes port @1@, startup would fail; free the port or pick another'
msg_source_help_zh='  auto = 先拉镜像，拉不到再本地构建；pull = 只拉镜像；build = 只本地构建'
msg_source_help_en='  auto = pull images, build locally if the pull fails; pull = pull only; build = build only'
msg_ask_source_zh='代码来源'
msg_ask_source_en='code source'
msg_ask_registry_zh='镜像仓库前缀'
msg_ask_registry_en='image registry prefix'
msg_ask_tag_zh='镜像 tag'
msg_ask_tag_en='image tag'
msg_ask_register_zh='是否开放注册'
msg_ask_register_en='keep registration open'
msg_ask_instance_host_zh='实例公网地址（选手访问容器题目的 host）'
msg_ask_instance_host_en='public instance host (the address players reach challenge containers on)'
msg_ask_instance_ports_zh='实例端口区间 MIN-MAX'
msg_ask_instance_ports_en='instance port range MIN-MAX'
msg_secrets_help_zh='  auto = 把占位符替换成随机密钥（沿用既有行为：数据库已有数据时不轮换口令）；manual = 保留现有值，脚本绝不读取或询问密码'
msg_secrets_help_en='  auto = replace placeholders with random secrets (existing databases keep their password); manual = keep current values, the script never reads or asks for a password'
msg_ask_secrets_zh='密钥处理方式'
msg_ask_secrets_en='secret handling'
msg_admin_help_zh='  脚本只打印提升管理员的 SQL，绝不代跑；注册仍需你在浏览器里完成。'
msg_admin_help_en='  the script only prints the SQL that promotes an administrator, it never runs it; registering still happens in the browser.'
msg_ask_admin_now_zh='是否在总结里打印创建第一个管理员的步骤'
msg_ask_admin_now_en='print the first-administrator steps in the summary'
msg_ask_admin_zh='管理员用户名（用于 SQL 里替换）'
msg_ask_admin_en='administrator username to substitute into the SQL'
msg_invalid_value_zh='无法接受的取值：@1@'
msg_invalid_value_en='unacceptable value: @1@'

# ---------------------------------------------------------------- secrets

msg_env_applying_zh='写入 @1@'
msg_env_applying_en='applying settings to @1@'
msg_secrets_manual_zh='按要求保留现有密钥，不做生成或轮换'
msg_secrets_manual_en='keeping the current secrets as requested, generating nothing'
msg_secrets_placeholder_zh='以下键仍是占位值：@1@。栈会用弱口令启动，请尽快在 @2@ 中替换并重启服务。'
msg_secrets_placeholder_en='these keys still hold placeholders: @1@. The stack starts with weak credentials, replace them in @2@ and restart as soon as possible.'
msg_secret_generating_zh='生成 @1@'
msg_secret_generating_en='generating @1@'
msg_secret_db_in_use_zh='卷 @1@ 已存在，数据库口令无法自动轮换（换口令会让旧数据失效）。请手动 ALTER USER，再更新环境文件里的 POSTGRES_PASSWORD。'
msg_secret_db_in_use_en='volume @1@ already exists, so the database password cannot be rotated automatically (a new password would make the existing data unreachable). ALTER USER manually, then update POSTGRES_PASSWORD in the env file.'

# ---------------------------------------------------------------- execution

msg_source_build_zh='本地构建镜像（不会使用 @1@ 上的远端镜像）'
msg_source_build_en='building images locally (nothing from @1@ is used)'
msg_source_pull_zh='拉取镜像 @1@/{backend,frontend}:@2@，@3@'
msg_source_pull_en='pulling @1@/{backend,frontend}:@2@, @3@'
msg_pull_deadline_zh='最多等 @1@ 秒'
msg_pull_deadline_en='waiting at most @1@ seconds'
msg_pull_deadline_none_zh='不设时限'
msg_pull_deadline_none_en='with no deadline'
msg_pull_timeout_missing_zh='系统里没有 timeout 命令，--pull-timeout 无法生效，本次拉取不设时限'
msg_pull_timeout_missing_en='no timeout command on this host, so --pull-timeout cannot apply and this pull is unbounded'
msg_source_pull_timeout_zh='拉取在 @1@ 秒后被中止'
msg_source_pull_timeout_en='the pull was cut off after @1@ seconds'
msg_source_pull_abort_timeout_zh='拉取超时，且 --source pull 不允许回退构建。可加大 --pull-timeout，或改用 --source auto / --source build。'
msg_source_pull_abort_timeout_en='the pull timed out and --source pull forbids the build fallback. Raise --pull-timeout, or use --source auto or --source build.'
msg_source_pull_ok_zh='镜像就绪，使用拉取到的镜像启动'
msg_source_pull_ok_en='images ready, starting with the pulled images'
msg_source_pull_failed_zh='拉取 @1@ 失败，且 --source pull 不允许回退构建。可用 --source auto 或 --source build。'
msg_source_pull_failed_en='pulling from @1@ failed and --source pull forbids the build fallback. Use --source auto or --source build.'
msg_source_pull_fallback_zh='拉取失败，回退为本地构建'
msg_source_pull_fallback_en='the pull failed, falling back to a local build'
msg_infra_start_zh='启动 postgres 与 redis'
msg_infra_start_en='starting postgres and redis'
msg_migrate_skipped_zh='按要求跳过迁移'
msg_migrate_skipped_en='skipping migrations as requested'
msg_migrate_running_zh='执行数据库迁移'
msg_migrate_running_en='applying database migrations'
msg_stack_start_zh='启动完整服务栈'
msg_stack_start_en='starting the full stack'
msg_health_waiting_zh='等待健康检查 @1@'
msg_health_waiting_en='waiting for the health check at @1@'
msg_health_skipped_zh='dry-run：跳过健康检查（目标 @1@）'
msg_health_skipped_en='dry run: skipping the health check for @1@'
msg_health_failed_zh='健康检查失败：@1@；请用 docker compose logs --tail=200 排查'
msg_health_failed_en='health check failed at @1@; inspect with docker compose logs --tail=200'

# ---------------------------------------------------------------- summary

msg_summary_head_zh='部署完成'
msg_summary_head_en='deployment ready'
msg_summary_url_zh='访问地址:'
msg_summary_url_en='URL:'
msg_summary_source_zh='代码来源:'
msg_summary_source_en='source:'
msg_summary_images_zh='镜像:'
msg_summary_images_en='images:'
msg_summary_project_zh='项目名:'
msg_summary_project_en='project:'
msg_summary_env_zh='环境文件:'
msg_summary_env_en='env file:'
msg_summary_register_zh='注册开关:'
msg_summary_register_en='registration:'
msg_summary_instance_zh='实例地址:'
msg_summary_instance_en='instances:'
msg_summary_status_zh='状态:'
msg_summary_status_en='status:'
msg_summary_done_zh='健康检查通过'
msg_summary_done_en='health check passed'
msg_summary_dry_zh='未执行（dry-run）'
msg_summary_dry_en='nothing executed (dry run)'
msg_source_mode_auto_zh='拉取，失败则本地构建'
msg_source_mode_auto_en='pulled, built locally on failure'
msg_source_mode_pull_zh='仅拉取镜像'
msg_source_mode_pull_en='pulled only'
msg_source_mode_build_zh='本地构建'
msg_source_mode_build_en='built locally'
msg_register_open_zh='开放'
msg_register_open_en='open'
msg_register_closed_zh='关闭'
msg_register_closed_en='closed'

msg_admin_head_zh='第一个管理员：'
msg_admin_head_en='First administrator:'
msg_admin_step1_zh='1. 在浏览器里注册账号，然后执行下面这条 SQL 把它提为管理员（脚本不会代跑）：'
msg_admin_step1_en='1. Register the account in the browser, then run this SQL to promote it (the script never runs it for you):'
msg_admin_step2_zh='2. 退出后重新登录，新的角色才会进入令牌。'
msg_admin_step2_en='2. Sign out and back in, the new role only reaches the token on the next login.'
msg_admin_skipped_zh="跳过了管理员步骤；注册后自行执行 UPDATE users SET role='admin' 提升账号。"
msg_admin_skipped_en="administrator steps skipped; promote your registered account with UPDATE users SET role='admin' when you are ready."
msg_useful_head_zh='常用命令：'
msg_useful_head_en='Useful commands:'
