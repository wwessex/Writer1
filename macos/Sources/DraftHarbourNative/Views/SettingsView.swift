import DraftHarbourNativeCore
import SwiftUI

struct SettingsView: View {
  @AppStorage("DraftHarbour.editor.fontSize") private var fontSize = 15.0
  @AppStorage("DraftHarbour.editor.pageView") private var pageView = false
  @AppStorage("DraftHarbour.editor.typewriterMode") private var typewriterMode = false
  @AppStorage("DraftHarbour.editor.theme") private var theme = "auto"
  @AppStorage("DraftHarbour.writing.dailyTarget") private var dailyTarget = 0
  @AppStorage("DraftHarbour.writing.weeklyTarget") private var weeklyTarget = 0
  @AppStorage("DraftHarbour.writing.defaultWordGoal") private var defaultWordGoal = 80_000
  @AppStorage("DraftHarbour.release.channel") private var releaseChannel = "stable"
  @AppStorage("DraftHarbour.ai.endpoint") private var aiEndpoint = "http://localhost:11434/v1/chat/completions"
  @AppStorage("DraftHarbour.ai.model") private var aiModel = "llama3.1"
  @AppStorage("DraftHarbour.ai.provider") private var aiProvider = "local-openai"
  @AppStorage("DraftHarbour.ai.translationLanguage") private var translationLanguage = "es"
  @AppStorage("DraftHarbour.sync.baseUrl") private var syncBaseURL = ""

  var body: some View {
    TabView {
      generalPane
        .tabItem { Label("General", systemImage: "gearshape") }
      editorPane
        .tabItem { Label("Editor", systemImage: "textformat") }
      goalsPane
        .tabItem { Label("Writing Goals", systemImage: "target") }
      aiPane
        .tabItem { Label("AI", systemImage: "sparkles") }
      syncPane
        .tabItem { Label("Sync", systemImage: "arrow.triangle.2.circlepath") }
      updatesPane
        .tabItem { Label("Updates", systemImage: "shippingbox") }
    }
    .padding()
    .frame(width: 580, height: 430)
  }

  private var generalPane: some View {
    Form {
      Section("Appearance") {
        Picker("Theme", selection: themeSelection) {
          Text("Auto").tag("auto")
          Text("Light").tag("light")
          Text("Dark").tag("dark")
        }
        .pickerStyle(.segmented)
      }

      Section("New Projects") {
        TextField("Default Project Word Goal", value: $defaultWordGoal, format: .number)
        Text("These defaults prefill the native New Project flow. Existing project-specific goals remain stored in the .dhproj document.")
          .foregroundStyle(.secondary)
      }
    }
    .formStyle(.grouped)
  }

  private var editorPane: some View {
    Form {
      Section("Typography") {
        Slider(value: $fontSize, in: 11...24, step: 1) {
          Text("Font Size")
        } minimumValueLabel: {
          Text("11")
        } maximumValueLabel: {
          Text("24")
        }
      }

      Section("Writing Surface") {
        Toggle("Use page view by default", isOn: $pageView)
        Toggle("Use typewriter mode by default", isOn: $typewriterMode)
      }
    }
    .formStyle(.grouped)
  }

  private var goalsPane: some View {
    Form {
      Section("Writing Targets") {
        TextField("Daily Words", value: $dailyTarget, format: .number)
        TextField("Weekly Words", value: $weeklyTarget, format: .number)
        TextField("Default Project Word Goal", value: $defaultWordGoal, format: .number)
      }
    }
    .formStyle(.grouped)
  }

  private var aiPane: some View {
    Form {
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
      }
    }
    .formStyle(.grouped)
  }

  private var syncPane: some View {
    Form {
      Section("Generic REST") {
        TextField("Base URL", text: $syncBaseURL)
      }

      Section("Cloud Providers") {
        Text("Dropbox and Google Drive connection details are document-specific and are managed from the Integrations workspace.")
          .foregroundStyle(.secondary)
      }
    }
    .formStyle(.grouped)
  }

  private var updatesPane: some View {
    Form {
      Section("Update Channel") {
        Picker("Channel", selection: $releaseChannel) {
          Text("Stable").tag("stable")
          Text("Beta").tag("beta")
          Text("Nightly").tag("nightly")
        }
        .pickerStyle(.segmented)
      }
    }
    .formStyle(.grouped)
  }

  private var themeSelection: Binding<String> {
    Binding {
      ThemePreference.normalizedRawValue(theme)
    } set: { newValue in
      theme = ThemePreference.normalizedRawValue(newValue)
    }
  }
}
