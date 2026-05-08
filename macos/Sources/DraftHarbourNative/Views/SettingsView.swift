import DraftHarbourNativeCore
import SwiftUI

struct SettingsView: View {
  @State private var settingsSearch = ""
  @State private var safeModeEnabled = NativeOperationalGuardrails.shared.isSafeModeEnabledForSession
  @State private var pinnedUpdateVersion = NativeOperationalGuardrails.shared.pinnedUpdateVersion ?? ""
  @State private var guardrailsMessage = ""

  @AppStorage("DraftHarbour.editor.fontSize") private var fontSize = 15.0
  @AppStorage("DraftHarbour.editor.fontFamily") private var fontFamily = "System"
  @AppStorage("DraftHarbour.editor.lineHeight") private var lineHeight = 1.5
  @AppStorage("DraftHarbour.editor.pageView") private var pageView = false
  @AppStorage("DraftHarbour.editor.typewriterMode") private var typewriterMode = false
  @AppStorage("DraftHarbour.editor.theme") private var theme = "auto"
  @AppStorage("DraftHarbour.editor.autosaveMs") private var autosaveMs = 1_000
  @AppStorage("DraftHarbour.writing.dailyTarget") private var dailyTarget = 0
  @AppStorage("DraftHarbour.writing.weeklyTarget") private var weeklyTarget = 0
  @AppStorage("DraftHarbour.writing.defaultWordGoal") private var defaultWordGoal = 80_000
  @AppStorage("DraftHarbour.writing.defaultDeadline") private var defaultDeadline = ""
  @AppStorage("DraftHarbour.release.channel") private var releaseChannel = "stable"
  @AppStorage("DraftHarbour.ai.endpoint") private var aiEndpoint = "http://localhost:11434/v1/chat/completions"
  @AppStorage("DraftHarbour.ai.model") private var aiModel = "llama3.1"
  @AppStorage("DraftHarbour.ai.provider") private var aiProvider = "local-openai"
  @AppStorage("DraftHarbour.ai.translationLanguage") private var translationLanguage = "es"
  @AppStorage("DraftHarbour.ai.defaultInsertionMode") private var defaultInsertionMode = PipelineInsertionMode.append.rawValue
  @AppStorage("DraftHarbour.assist.languageToolEnabled") private var languageToolEnabled = false
  @AppStorage("DraftHarbour.assist.languageToolUrl") private var languageToolURL = "https://api.languagetool.org/v2/check"
  @AppStorage("DraftHarbour.assist.languageToolLanguage") private var languageToolLanguage = "en-US"
  @AppStorage("DraftHarbour.export.defaultFormat") private var exportDefaultFormat = ExportFormat.markdown.rawValue
  @AppStorage("DraftHarbour.export.includeSnapshots") private var exportIncludeSnapshots = true
  @AppStorage("DraftHarbour.export.includeIntegrationArtifacts") private var exportIncludeIntegrationArtifacts = false
  @AppStorage("DraftHarbour.export.validateBeforeExport") private var exportValidateBeforeExport = true
  @AppStorage("DraftHarbour.spotlight.indexingLevel") private var spotlightIndexingLevelRaw = SpotlightIndexingLevel.metadataOnly.rawValue
  @AppStorage("DraftHarbour.onboarding.defaultGenre") private var onboardingGenre = ""
  @AppStorage("DraftHarbour.onboarding.defaultAudience") private var onboardingAudience = ""
  @AppStorage("DraftHarbour.onboarding.defaultStructure") private var onboardingStructure = StoryStructurePreference.threeAct.rawValue
  @AppStorage("DraftHarbour.onboarding.defaultPacing") private var onboardingPacing = PacingProfile.balanced.rawValue
  @AppStorage("DraftHarbour.sync.baseUrl") private var syncBaseURL = ""

  var body: some View {
    VStack(spacing: 12) {
      settingsHeader

      TabView {
        generalPane
          .tabItem { Label("General", systemImage: "gearshape") }
        editorPane
          .tabItem { Label("Editor", systemImage: "textformat") }
        goalsPane
          .tabItem { Label("Goals", systemImage: "target") }
        assistPane
          .tabItem { Label("Checks", systemImage: "checkmark.seal") }
        aiPane
          .tabItem { Label("AI", systemImage: "sparkles") }
        exportPane
          .tabItem { Label("Export", systemImage: "square.and.arrow.up") }
        syncPane
          .tabItem { Label("Sync", systemImage: "arrow.triangle.2.circlepath") }
        updatesPane
          .tabItem { Label("Updates", systemImage: "shippingbox") }
      }
    }
    .padding()
    .frame(width: 700, height: 540)
  }

  private var settingsHeader: some View {
    HStack(spacing: 10) {
      Image(systemName: "magnifyingglass")
        .foregroundStyle(.secondary)
      TextField("Search settings", text: $settingsSearch)
        .textFieldStyle(.roundedBorder)
      if !settingsSearch.isEmpty {
        Button {
          settingsSearch = ""
        } label: {
          Image(systemName: "xmark.circle.fill")
        }
        .buttonStyle(.borderless)
        .help("Clear search")
      }
    }
  }

  private var generalPane: some View {
    Form {
      if sectionMatches("appearance theme auto light dark general") {
        Section("Appearance") {
          Picker("Theme", selection: themeSelection) {
            Text("Auto").tag("auto")
            Text("Light").tag("light")
            Text("Dark").tag("dark")
          }
          .pickerStyle(.segmented)
        }
      }

      if sectionMatches("spotlight privacy indexing search metadata full text off") {
        Section("Spotlight") {
          Picker("Project Indexing", selection: $spotlightIndexingLevelRaw) {
            ForEach(SpotlightIndexingLevel.allCases) { level in
              Text(level.title).tag(level.rawValue)
            }
          }
          Text("Metadata Only indexes project, section titles, and tags. Full Text also indexes manuscript body text.")
            .foregroundStyle(.secondary)
        }
      }

      if sectionMatches("new projects default word goal project title onboarding genre audience structure pacing") {
        Section("New Projects") {
          TextField("Default Project Word Goal", value: $defaultWordGoal, format: .number)
          TextField("Default Deadline (YYYY-MM-DD)", text: $defaultDeadline)
          TextField("Default Genre", text: $onboardingGenre)
          TextField("Default Audience", text: $onboardingAudience)
          Picker("Default Structure", selection: $onboardingStructure) {
            ForEach(StoryStructurePreference.allCases, id: \.rawValue) { structure in
              Text(structureTitle(structure.rawValue)).tag(structure.rawValue)
            }
          }
          Picker("Default Pacing", selection: $onboardingPacing) {
            ForEach(PacingProfile.allCases, id: \.rawValue) { pacing in
              Text(pacingTitle(pacing.rawValue)).tag(pacing.rawValue)
            }
          }
          Text("These defaults prefill native project setup and onboarding. Existing .dhproj document settings are left unchanged.")
            .foregroundStyle(.secondary)
        }
      }

      if !paneMatches("appearance theme auto light dark general spotlight privacy indexing search metadata full text off new projects default word goal project title onboarding genre audience structure pacing deadline") {
        Section {
          noResultsText
        }
      }
    }
    .formStyle(.grouped)
  }

  private var editorPane: some View {
    Form {
      if sectionMatches("typography font family size line height editor") {
        Section("Typography") {
          TextField("Font Family", text: $fontFamily)
          Slider(value: $fontSize, in: 11...24, step: 1) {
            Text("Font Size")
          } minimumValueLabel: {
            Text("11")
          } maximumValueLabel: {
            Text("24")
          }
          Stepper(value: $lineHeight, in: 1.1...2.2, step: 0.05) {
            Text("Line Height \(lineHeight, format: .number.precision(.fractionLength(2)))")
          }
        }
      }

      if sectionMatches("writing surface page view typewriter focus autosave editor defaults") {
        Section("Writing Surface") {
          Toggle("Use page view by default", isOn: $pageView)
          Toggle("Use typewriter mode by default", isOn: $typewriterMode)
          Stepper(value: $autosaveMs, in: 500...10_000, step: 500) {
            Text("Autosave Interval \(Double(autosaveMs) / 1_000, format: .number.precision(.fractionLength(1)))s")
          }
        }
      }

      if !paneMatches("typography font family size line height editor writing surface page view typewriter focus autosave defaults") {
        Section {
          noResultsText
        }
      }
    }
    .formStyle(.grouped)
  }

  private var goalsPane: some View {
    Form {
      if sectionMatches("writing targets goals daily weekly project deadline") {
        Section("Writing Targets") {
          TextField("Daily Words", value: $dailyTarget, format: .number)
          TextField("Weekly Words", value: $weeklyTarget, format: .number)
          TextField("Default Project Word Goal", value: $defaultWordGoal, format: .number)
          TextField("Default Deadline (YYYY-MM-DD)", text: $defaultDeadline)
        }
      }

      if sectionMatches("goal trend warnings pace streak dashboard history overdue") {
        Section("Dashboard Signals") {
          Text("Dashboard pacing, streaks, goal trends, overdue sections, and words-today metrics are calculated from the active .dhproj document.")
            .foregroundStyle(.secondary)
        }
      }

      if !paneMatches("writing targets goals daily weekly project deadline goal trend warnings pace streak dashboard history overdue") {
        Section {
          noResultsText
        }
      }
    }
    .formStyle(.grouped)
  }

  private var assistPane: some View {
    Form {
      if sectionMatches("languagetool grammar style spell spelling checks language url endpoint") {
        Section("LanguageTool") {
          Toggle("Enable LanguageTool checks by default", isOn: $languageToolEnabled)
          TextField("Check URL", text: $languageToolURL)
          TextField("Language", text: $languageToolLanguage)
          Text("Grammar and style checks remain opt-in and can use a local or hosted LanguageTool-compatible endpoint.")
            .foregroundStyle(.secondary)
        }
      }

      if sectionMatches("analysis readability repetitions sentiment narrative weather long sentences") {
        Section("Analysis Defaults") {
          Text("Readability, repetitions, sentiment, narrative weather, and long-sentence checks run locally from the Analysis panel.")
            .foregroundStyle(.secondary)
        }
      }

      if !paneMatches("languagetool grammar style spell spelling checks language url endpoint analysis readability repetitions sentiment narrative weather long sentences") {
        Section {
          noResultsText
        }
      }
    }
    .formStyle(.grouped)
  }

  private var aiPane: some View {
    Form {
      if sectionMatches("ai provider endpoint model default local openai translation suggestions insertion") {
        Section("Default Provider") {
          Picker("Provider", selection: $aiProvider) {
            Text("Local OpenAI-compatible").tag("local-openai")
            Text("OpenAI-compatible").tag("openai-compatible")
            Text("Server Proxy").tag("server-proxy")
            Text("Custom LLM").tag("custom-llm")
          }
          TextField("Endpoint", text: $aiEndpoint)
          TextField("Model", text: $aiModel)
          Picker("Selection Translation", selection: $translationLanguage) {
            ForEach(AIWorkflowServices.translationLanguages) { language in
              Text(language.name).tag(language.code)
            }
          }
          Picker("Default Insertion", selection: $defaultInsertionMode) {
            Text("Append").tag(PipelineInsertionMode.append.rawValue)
            Text("Replace Selection").tag(PipelineInsertionMode.replace.rawValue)
            Text("Side by Side").tag(PipelineInsertionMode.sideBySide.rawValue)
          }
        }
      }

      if sectionMatches("publishing assistant synopsis description keywords category ai suggestions") {
        Section("Assistant Surfaces") {
          Text("AI Suggestions and Publishing Assistant use these provider defaults, while individual document providers stay configurable per project.")
            .foregroundStyle(.secondary)
        }
      }

      if !paneMatches("ai provider endpoint model default local openai translation suggestions insertion publishing assistant synopsis description keywords category") {
        Section {
          noResultsText
        }
      }
    }
    .formStyle(.grouped)
  }

  private var exportPane: some View {
    Form {
      if sectionMatches("export defaults format markdown txt fountain rtf pdf docx publishing bundle") {
        Section("Export Defaults") {
          Picker("Default Format", selection: $exportDefaultFormat) {
            ForEach(ExportFormat.allCases, id: \.rawValue) { format in
              Text(exportTitle(format)).tag(format.rawValue)
            }
          }
          Toggle("Validate before export", isOn: $exportValidateBeforeExport)
          Toggle("Include snapshots in project backups", isOn: $exportIncludeSnapshots)
          Toggle("Include integration artifacts in backups", isOn: $exportIncludeIntegrationArtifacts)
        }
      }

      if sectionMatches("export history presets options publishing assistant") {
        Section("History and Presets") {
          Text("Export presets, recent export history, validation issues, and publishing bundle drafts are available from the Export tool panel.")
            .foregroundStyle(.secondary)
        }
      }

      if !paneMatches("export defaults format markdown txt fountain rtf pdf docx publishing bundle history presets options validation snapshots integration artifacts") {
        Section {
          noResultsText
        }
      }
    }
    .formStyle(.grouped)
  }

  private var syncPane: some View {
    Form {
      if sectionMatches("generic rest sync base url") {
        Section("Generic REST") {
          TextField("Base URL", text: $syncBaseURL)
        }
      }

      if sectionMatches("cloud providers dropbox google drive integrations document specific") {
        Section("Cloud Providers") {
          Text("Dropbox and Google Drive connection details are document-specific and are managed from the Integrations workspace.")
            .foregroundStyle(.secondary)
        }
      }

      if !paneMatches("generic rest sync base url cloud providers dropbox google drive integrations document specific") {
        Section {
          noResultsText
        }
      }
    }
    .formStyle(.grouped)
  }

  private var updatesPane: some View {
    Form {
      if sectionMatches("update channel stable beta nightly release") {
        Section("Update Channel") {
          Picker("Channel", selection: $releaseChannel) {
            Text("Stable").tag("stable")
            Text("Beta").tag("beta")
            Text("Nightly").tag("nightly")
          }
          .pickerStyle(.segmented)
        }
      }

      if sectionMatches("safe mode policy managed updates crash guardrails fallback pin version signed local only") {
        Section("Operational Guardrails") {
          Toggle("Safe Mode for Current Session", isOn: safeModeBinding)
          Button("Enable Safe Mode on Next Launch") {
            NativeOperationalGuardrails.shared.enableSafeModeForNextLaunch()
            guardrailsMessage = "Safe mode will be enabled after the app restarts."
          }
          HStack {
            TextField("Pinned update version", text: $pinnedUpdateVersion)
            Button("Save Pin") {
              NativeOperationalGuardrails.shared.pinUpdateVersion(pinnedUpdateVersion)
              pinnedUpdateVersion = NativeOperationalGuardrails.shared.pinnedUpdateVersion ?? ""
              guardrailsMessage = pinnedUpdateVersion.isEmpty ? "Update pin cleared." : "Updates pinned to \(pinnedUpdateVersion)."
            }
          }
          HStack {
            LabeledContent("Failed Update Attempts", value: "\(NativeOperationalGuardrails.shared.updateFailureCount)")
            Button("Clear Failures") {
              NativeOperationalGuardrails.shared.clearUpdateFailures()
              guardrailsMessage = "Update fallback counter cleared."
            }
          }
          LabeledContent("Fallback Mode", value: NativeOperationalGuardrails.shared.isUpdaterFallbackMode ? "Enabled" : "Disabled")
          LabeledContent("Last Good Version", value: NativeOperationalGuardrails.shared.lastGoodVersion ?? "Not recorded")
          let policy = NativeOperationalGuardrails.shared.currentPolicy()
          LabeledContent("Managed Policy", value: managedPolicySummary(policy))
          if let remoteCrashReportURL = policy.remoteCrashReportURL, !remoteCrashReportURL.isEmpty {
            LabeledContent("Crash Endpoint", value: remoteCrashReportURL)
          }
          if !guardrailsMessage.isEmpty {
            Text(guardrailsMessage)
              .foregroundStyle(.secondary)
          }
          Text("Safe mode disables plugin callbacks and filters for the current session. Managed policy can force local-only operation, disable AI providers, and apply settings overrides.")
            .foregroundStyle(.secondary)
        }
      }

      if !paneMatches("update channel stable beta nightly release safe mode policy managed updates crash guardrails fallback pin version signed local only") {
        Section {
          noResultsText
        }
      }
    }
    .formStyle(.grouped)
  }

  private var noResultsText: some View {
    Text("No settings match \"\(settingsSearch)\".")
      .foregroundStyle(.secondary)
  }

  private var themeSelection: Binding<String> {
    Binding {
      ThemePreference.normalizedRawValue(theme)
    } set: { newValue in
      theme = ThemePreference.normalizedRawValue(newValue)
    }
  }

  private var safeModeBinding: Binding<Bool> {
    Binding {
      safeModeEnabled
    } set: { newValue in
      safeModeEnabled = newValue
      NativeOperationalGuardrails.shared.setSafeModeForCurrentSession(newValue)
      guardrailsMessage = newValue ? "Safe mode is active for this session." : "Safe mode is disabled for this session."
    }
  }

  private func managedPolicySummary(_ policy: NativeManagedPolicy) -> String {
    var parts: [String] = []
    if policy.forceLocalOnly == true {
      parts.append("local-only")
    }
    if policy.disableAIProviders == true {
      parts.append("AI disabled")
    }
    if policy.disableTelemetry == true {
      parts.append("telemetry disabled")
    }
    if let disabled = policy.disabledAIProviderTypes, !disabled.isEmpty {
      parts.append("disabled providers: \(disabled.map(\.rawValue).joined(separator: ", "))")
    }
    if policy.requireSignedUpdates == true {
      parts.append("signed updates required")
    }
    if policy.settingsOverrides != nil {
      parts.append("settings overrides")
    }
    return parts.isEmpty ? "None" : parts.joined(separator: ", ")
  }

  private func sectionMatches(_ terms: String) -> Bool {
    let query = settingsSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return true }
    return terms.localizedCaseInsensitiveContains(query)
  }

  private func paneMatches(_ terms: String) -> Bool {
    sectionMatches(terms)
  }

  private func structureTitle(_ rawValue: String) -> String {
    switch rawValue {
    case StoryStructurePreference.saveTheCat.rawValue:
      return "Save the Cat"
    case StoryStructurePreference.heroJourney.rawValue:
      return "Hero's Journey"
    default:
      return "Three Act"
    }
  }

  private func pacingTitle(_ rawValue: String) -> String {
    switch rawValue {
    case PacingProfile.fast.rawValue:
      return "Fast"
    case PacingProfile.slowBurn.rawValue:
      return "Slow Burn"
    default:
      return "Balanced"
    }
  }

  private func exportTitle(_ format: ExportFormat) -> String {
    switch format {
    case .markdown:
      return "Markdown"
    case .plainText:
      return "Plain Text"
    case .fountain:
      return "Fountain"
    case .rtf:
      return "RTF"
    case .pdf:
      return "PDF"
    case .screenplayPdf:
      return "Screenplay PDF"
    case .docx:
      return "DOCX"
    case .publishingBundle:
      return "Publishing Bundle"
    }
  }
}
