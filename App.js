import React, { useState, useEffect, useRef } from "react";

import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  StatusBar,
  Alert,
  Keyboard,
  ActivityIndicator,
} from "react-native";

import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

// Novas bibliotecas para exportação CSV
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import Grafico from "./src/components/Grafico";
import Janela from "./src/components/Janela";


// ===================================
// CHAVE DO ARMAZENAMENTO LOCAL
// ===================================

const CHAVE_DADOS = "@FinancasNoBolso:dados:v1";


export default function App() {

  // ===================================
  // ESTADOS DA APLICAÇÃO
  // ===================================

  const [limite, definirLimite] = useState("1000");

  const [movimentacoes, definirMovimentacoes] = useState([]);

  const [tipo, mudarTipo] = useState("despesa");
  const [categoria, mudarCategoria] = useState("");
  const [valor, mudarValor] = useState("");

  const [metaReceitas, definirMetaReceitas] = useState("1000");
  const [metaEconomia, definirMetaEconomia] = useState("500");


  // ===================================
  // ESTADOS PARA EDIÇÃO
  // ===================================

  const [idEmEdicao, definirIdEmEdicao] = useState(null);

  const [tipoEdicao, mudarTipoEdicao] = useState("despesa");
  const [categoriaEdicao, mudarCategoriaEdicao] = useState("");
  const [valorEdicao, mudarValorEdicao] = useState("");


  // ===================================
  // ESTADOS DO ARMAZENAMENTO
  // ===================================

  const [situacaoDados, definirSituacaoDados] =
    useState("carregando");

  const [erroSalvamento, definirErroSalvamento] =
    useState(false);

  const [tentativaLeitura, definirTentativaLeitura] =
    useState(0);

  const filaGravacao = useRef(Promise.resolve());


  // ===================================
  // NOVO ESTADO PARA EXPORTAÇÃO
  // ===================================

  // Evita novas exportações enquanto o arquivo
  // anterior está sendo preparado e compartilhado.
  const [exportando, definirExportando] = useState(false);


  // ===================================
  // VALIDAR DADOS RECUPERADOS
  // ===================================

  function DadosArmazenadosValidos(dados) {

    if (
      dados === null ||
      typeof dados !== "object" ||
      Array.isArray(dados)
    ) {
      return false;
    }

    if (
      !Array.isArray(dados.movimentacoes) ||
      typeof dados.limite !== "string" ||
      typeof dados.metaReceitas !== "string" ||
      typeof dados.metaEconomia !== "string"
    ) {
      return false;
    }

    return dados.movimentacoes.every(function (item) {

      return (
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        (item.tipo === "receita" || item.tipo === "despesa") &&
        typeof item.categoria === "string" &&
        typeof item.valor === "number" &&
        Number.isFinite(item.valor) &&
        item.valor > 0
      );
    });
  }


  // ===================================
  // CARREGAR DADOS SALVOS
  // ===================================

  useEffect(() => {

    let cancelado = false;

    async function CarregarDados() {

      definirSituacaoDados("carregando");

      try {

        const dadosEmTexto =
          await AsyncStorage.getItem(CHAVE_DADOS);

        if (cancelado) {
          return;
        }

        if (dadosEmTexto !== null) {

          const dados = JSON.parse(dadosEmTexto);

          if (!DadosArmazenadosValidos(dados)) {
            throw new Error(
              "Os dados armazenados possuem formato inválido."
            );
          }

          definirMovimentacoes(dados.movimentacoes);
          definirLimite(dados.limite);
          definirMetaReceitas(dados.metaReceitas);
          definirMetaEconomia(dados.metaEconomia);
        }

        definirSituacaoDados("pronto");

      } catch (erro) {

        if (cancelado) {
          return;
        }

        console.error(
          "Erro ao carregar dados financeiros:",
          erro
        );

        definirSituacaoDados("erro");
      }
    }

    CarregarDados();

    return function () {
      cancelado = true;
    };

  }, [tentativaLeitura]);


  // ===================================
  // SALVAR DADOS AUTOMATICAMENTE
  // ===================================

  useEffect(() => {

    if (situacaoDados !== "pronto") {
      return;
    }

    const dadosParaSalvar = {
      movimentacoes: movimentacoes,
      limite: limite,
      metaReceitas: metaReceitas,
      metaEconomia: metaEconomia,
    };

    const dadosEmTexto = JSON.stringify(dadosParaSalvar);

    filaGravacao.current = filaGravacao.current
      .catch(function () {
        // Permite continuar após uma falha anterior.
      })
      .then(async function () {

        await AsyncStorage.setItem(
          CHAVE_DADOS,
          dadosEmTexto
        );

        definirErroSalvamento(false);
      })
      .catch(function (erro) {

        console.error(
          "Erro ao salvar dados financeiros:",
          erro
        );

        definirErroSalvamento(true);
      });

  }, [
    movimentacoes,
    limite,
    metaReceitas,
    metaEconomia,
    situacaoDados,
  ]);


  // ===================================
  // TENTAR NOVAMENTE O CARREGAMENTO
  // ===================================

  function TentarCarregarNovamente() {

    definirTentativaLeitura(
      tentativaAtual => tentativaAtual + 1
    );
  }


  // ===================================
  // CONVERSÃO DE VALORES
  // ===================================

  function ConverterValor(texto) {

    const valorTexto = String(texto).trim();

    if (!/^\d+([.,]\d{1,2})?$/.test(valorTexto)) {
      return null;
    }

    const numero = Number(
      valorTexto.replace(",", ".")
    );

    if (!Number.isFinite(numero)) {
      return null;
    }

    return numero;
  }


  // ===================================
  // ADICIONAR MOVIMENTAÇÃO
  // ===================================

  function AdicionarMovimentacao() {

    const valorNumerico = ConverterValor(valor);
    const categoriaLimpa = categoria.trim();

    if (categoriaLimpa === "") {
      Alert.alert(
        "Categoria obrigatória",
        "Informe o motivo da movimentação."
      );

      return false;
    }

    if (valorNumerico === null || valorNumerico <= 0) {
      Alert.alert(
        "Valor inválido",
        "Informe um valor maior que zero, com até duas casas decimais."
      );

      return false;
    }

    if (tipo !== "receita" && tipo !== "despesa") {
      Alert.alert(
        "Tipo inválido",
        "Selecione receita ou despesa."
      );

      return false;
    }

    const novaMovimentacao = {
      id: `${Date.now()}-${Math.random()}`,
      tipo: tipo,
      categoria: categoriaLimpa,
      valor: valorNumerico,
    };

    definirMovimentacoes(listaAtual => [
      ...listaAtual,
      novaMovimentacao,
    ]);

    mudarCategoria("");
    mudarValor("");

    Keyboard.dismiss();

    return true;
  }


  // ===================================
  // INICIAR EDIÇÃO
  // ===================================

  function IniciarEdicao(movimentacao) {

    definirIdEmEdicao(movimentacao.id);

    mudarTipoEdicao(movimentacao.tipo);
    mudarCategoriaEdicao(movimentacao.categoria);

    mudarValorEdicao(
      String(movimentacao.valor).replace(".", ",")
    );
  }


  // ===================================
  // CANCELAR EDIÇÃO
  // ===================================

  function CancelarEdicao() {

    definirIdEmEdicao(null);

    mudarTipoEdicao("despesa");
    mudarCategoriaEdicao("");
    mudarValorEdicao("");

    Keyboard.dismiss();
  }


  // ===================================
  // SALVAR EDIÇÃO
  // ===================================

  function SalvarEdicao() {

    if (idEmEdicao === null) {
      return false;
    }

    const categoriaLimpa = categoriaEdicao.trim();
    const valorNumerico = ConverterValor(valorEdicao);

    if (categoriaLimpa === "") {
      Alert.alert(
        "Categoria obrigatória",
        "Informe o motivo da movimentação."
      );

      return false;
    }

    if (valorNumerico === null || valorNumerico <= 0) {
      Alert.alert(
        "Valor inválido",
        "Informe um valor maior que zero, com até duas casas decimais."
      );

      return false;
    }

    if (tipoEdicao !== "receita" && tipoEdicao !== "despesa") {
      Alert.alert(
        "Tipo inválido",
        "Selecione receita ou despesa."
      );

      return false;
    }

    definirMovimentacoes(listaAtual =>
      listaAtual.map(function (movimentacao) {

        if (movimentacao.id === idEmEdicao) {

          return {
            ...movimentacao,
            tipo: tipoEdicao,
            categoria: categoriaLimpa,
            valor: valorNumerico,
          };
        }

        return movimentacao;
      })
    );

    CancelarEdicao();

    return true;
  }


  // ===================================
  // EXCLUIR MOVIMENTAÇÃO
  // ===================================

  function ExcluirMovimentacao(movimentacao) {

    Alert.alert(
      "Excluir movimentação",
      `Deseja excluir "${movimentacao.categoria}" no valor de ${FormatarMoeda(movimentacao.valor)}?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Excluir",
          style: "destructive",
          onPress: function () {

            definirMovimentacoes(listaAtual =>
              listaAtual.filter(function (item) {
                return item.id !== movimentacao.id;
              })
            );

            if (idEmEdicao === movimentacao.id) {
              CancelarEdicao();
            }
          },
        },
      ]
    );
  }


  // ===================================
  // TOTAL DE RECEITAS
  // ===================================

  function TotalReceitas() {

    let total = 0;

    for (const movimentacao of movimentacoes) {
      if (movimentacao.tipo === "receita") {
        total += movimentacao.valor;
      }
    }

    return total;
  }


  // ===================================
  // TOTAL DE DESPESAS
  // ===================================

  function TotalDespesas() {

    let total = 0;

    for (const movimentacao of movimentacoes) {
      if (movimentacao.tipo === "despesa") {
        total += movimentacao.valor;
      }
    }

    return total;
  }


  // ===================================
  // BALANÇO FINANCEIRO
  // ===================================

  function CalcularBalanco() {

    const receitas = TotalReceitas();
    const despesas = TotalDespesas();

    return receitas - despesas;
  }


  // ===================================
  // FORMATAÇÃO DE MOEDA
  // ===================================

  function FormatarMoeda(numero) {

    return numero.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }


  // ===================================
  // PORCENTAGEM DE DESPESAS
  // ===================================

  function PorcentagemDespesas() {

    const limiteNumerico = ConverterValor(limite);

    if (limiteNumerico === null || limiteNumerico <= 0) {
      return 0;
    }

    return (TotalDespesas() / limiteNumerico) * 100;
  }


  // ===================================
  // PORCENTAGEM DE RECEITAS
  // ===================================

  function PorcentagemReceitas() {

    const metaNumerica = ConverterValor(metaReceitas);

    if (metaNumerica === null || metaNumerica <= 0) {
      return 0;
    }

    return (TotalReceitas() / metaNumerica) * 100;
  }


  // ===================================
  // PORCENTAGEM DE ECONOMIA
  // ===================================

  function PorcentagemEconomia() {

    const metaNumerica = ConverterValor(metaEconomia);

    if (metaNumerica === null || metaNumerica <= 0) {
      return 0;
    }

    const balanco = CalcularBalanco();

    if (balanco <= 0) {
      return 0;
    }

    return (balanco / metaNumerica) * 100;
  }


  // ===================================
  // NOVO: PREPARAR TEXTO PARA CSV
  // ===================================

  function PrepararCampoCSV(texto) {

    let conteudo = String(texto);

    // Impede que textos iniciados como fórmulas
    // sejam interpretados como comandos em planilhas.
    if (
      /^\s*[=+\-@]/.test(conteudo) ||
      /^[\t\r\n]/.test(conteudo)
    ) {
      conteudo = "'" + conteudo;
    }

    // Aspas internas precisam ser duplicadas.
    conteudo = conteudo.replace(/"/g, '""');

    // Coloca o campo entre aspas para permitir
    // ponto e vírgula e quebras de linha.
    return '"' + conteudo + '"';
  }


  // ===================================
  // NOVO: EXPORTAR HISTÓRICO EM CSV
  // ===================================

  async function ExportarHistorico() {

    // Não permite exportações simultâneas.
    if (exportando) {
      return;
    }

    if (movimentacoes.length === 0) {
      Alert.alert(
        "Histórico vazio",
        "Cadastre uma receita ou despesa antes de exportar."
      );
      return;
    }

    definirExportando(true);

    try {

      // Verifica se o compartilhamento é suportado.
      const compartilhamentoDisponivel =
        await Sharing.isAvailableAsync();

      if (!compartilhamentoDisponivel) {
        Alert.alert(
          "Compartilhamento indisponível",
          "Este dispositivo não permite compartilhar o arquivo."
        );
        return;
      }

      // O separador ; é conveniente para planilhas
      // configuradas em português brasileiro.
      const linhas = [
        "Tipo;Categoria;Valor (R$)"
      ];

      // Exporta os registros mais recentes primeiro.
      const listaExportacao = [...movimentacoes].reverse();

      for (const movimentacao of listaExportacao) {

        const tipoTexto =
          movimentacao.tipo === "receita"
            ? "Receita"
            : "Despesa";

        const categoriaTexto =
          PrepararCampoCSV(movimentacao.categoria);

        // Duas casas decimais e vírgula decimal.
        const valorTexto =
          movimentacao.valor.toFixed(2).replace(".", ",");

        const linha =
          PrepararCampoCSV(tipoTexto) + ";" +
          categoriaTexto + ";" +
          valorTexto;

        linhas.push(linha);
      }

      // BOM UTF-8: ajuda aplicativos de planilha
      // a reconhecer corretamente os acentos.
      const conteudoCSV =
        "\uFEFF" + linhas.join("\r\n") + "\r\n";

      // Nome único para não sobrescrever
      // exportações temporárias anteriores.
      const nomeArquivo =
        "FinancasNoBolso_" + Date.now() + ".csv";

      // Cria uma referência ao arquivo temporário.
      const arquivo = new File(
        Paths.cache,
        nomeArquivo
      );

      // Cria o arquivo e escreve o CSV.
      arquivo.create();

      await arquivo.write(conteudoCSV);

      // Abre o menu de compartilhamento do dispositivo.
      await Sharing.shareAsync(arquivo.uri, {
        mimeType: "text/csv",
        dialogTitle: "Exportar Histórico Financeiro",
        UTI: "public.comma-separated-values-text",
      });

    } catch (erro) {

      console.error(
        "Erro ao exportar histórico financeiro:",
        erro
      );

      Alert.alert(
        "Erro na exportação",
        "Não foi possível preparar ou compartilhar o arquivo CSV."
      );

    } finally {

      // Libera o botão mesmo se ocorrer um erro.
      definirExportando(false);
    }
  }


  // ===================================
  // VALIDAÇÕES E APRESENTAÇÃO
  // ===================================

  const limiteNumerico = ConverterValor(limite);

  const limiteValido =
    limiteNumerico !== null && limiteNumerico > 0;

  const metaReceitasNumerica = ConverterValor(metaReceitas);

  const metaReceitasValida =
    metaReceitasNumerica !== null && metaReceitasNumerica > 0;

  const metaEconomiaNumerica = ConverterValor(metaEconomia);

  const metaEconomiaValida =
    metaEconomiaNumerica !== null && metaEconomiaNumerica > 0;

  const corBalanco =
    CalcularBalanco() > 0
      ? "#698269"
      : CalcularBalanco() < 0
        ? "#C76852"
        : "#333333";


  // ===================================
  // ALERTAS DO LIMITE DE DESPESAS
  // ===================================

  const percentualDespesas = PorcentagemDespesas();

  let mensagemAlerta = null;
  let corAlerta = "";
  let fundoAlerta = "";

  if (limiteValido) {

    if (percentualDespesas >= 100) {

      mensagemAlerta =
        "Limite de despesas atingido! Você já utilizou " +
        percentualDespesas.toFixed(1).replace(".", ",") +
        "% do limite planejado.";

      corAlerta = "#A14F3F";
      fundoAlerta = "#F8E5E1";

    } else if (percentualDespesas >= 80) {

      mensagemAlerta =
        "Atenção ao limite de despesas! Você já utilizou " +
        percentualDespesas.toFixed(1).replace(".", ",") +
        "% do limite planejado.";

      corAlerta = "#8A5A15";
      fundoAlerta = "#FFF1D6";
    }
  }


  // ===================================
  // TELA DE CARREGAMENTO OU ERRO
  // ===================================

  if (situacaoDados !== "pronto") {

    return (
      <SafeAreaProvider>

        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: "#F7F8F6",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >

          {situacaoDados === "carregando" ? (

            <View style={{ alignItems: "center" }}>

              <ActivityIndicator
                size="large"
                color="#698269"
              />

              <Text
                style={{
                  color: "#444",
                  fontSize: 16,
                  marginTop: 16,
                  textAlign: "center",
                }}
              >
                Carregando dados financeiros...
              </Text>

            </View>

          ) : (

            <View style={{ alignItems: "center" }}>

              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: "#A14F3F",
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                Não foi possível carregar os dados
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  color: "#555",
                  textAlign: "center",
                  marginBottom: 20,
                }}
              >
                Seus registros não foram apagados
                pelo aplicativo. Verifique o erro
                e tente carregar novamente.
              </Text>

              <Pressable
                onPress={TentarCarregarNovamente}
                accessibilityRole="button"
                style={{
                  backgroundColor: "#698269",
                  padding: 14,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "bold",
                  }}
                >
                  Tentar Novamente
                </Text>
              </Pressable>

            </View>

          )}

        </SafeAreaView>

      </SafeAreaProvider>
    );
  }


  // ===================================
  // INTERFACE DA APLICAÇÃO
  // ===================================

  return (
    <SafeAreaProvider>

      <StatusBar barStyle="dark-content" />

      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#F7F8F6",
        }}
      >

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 24 }}
        >

          {/* TÍTULO PRINCIPAL */}

          <Text
            style={{
              fontSize: 26,
              fontWeight: "bold",
              textAlign: "center",
              color: "#698269",
              marginTop: 20,
              marginBottom: 12,
            }}
          >
            Finanças no Bolso
          </Text>


          {/* ERRO DE SALVAMENTO */}

          {erroSalvamento && (

            <View
              style={{
                backgroundColor: "#F8E5E1",
                borderLeftWidth: 4,
                borderLeftColor: "#A14F3F",
                borderRadius: 8,
                padding: 12,
                marginHorizontal: 16,
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: "#A14F3F",
                  fontWeight: "bold",
                  fontSize: 14,
                }}
              >
                Não foi possível salvar os dados.
                Verifique o erro antes de fechar
                o aplicativo. Uma nova alteração
                tentará salvar novamente.
              </Text>
            </View>

          )}


          {/* ===================================
              RESUMO FINANCEIRO
          =================================== */}

          <Janela>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                textAlign: "center",
                color: "#252525",
                marginBottom: 16,
              }}
            >
              Resumo Financeiro
            </Text>

            <View
              style={{
                flexDirection: "row",
                marginBottom: 16,
              }}
            >

              {/* RECEITAS */}

              <View
                style={{
                  flex: 1,
                  backgroundColor: "#E3F0E5",
                  padding: 12,
                  borderRadius: 8,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: "#456B4A",
                    marginBottom: 6,
                  }}
                >
                  Receitas
                </Text>

                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "bold",
                    color: "#456B4A",
                  }}
                >
                  {FormatarMoeda(TotalReceitas())}
                </Text>
              </View>


              {/* DESPESAS */}

              <View
                style={{
                  flex: 1,
                  backgroundColor: "#F8E5E1",
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: "#A14F3F",
                    marginBottom: 6,
                  }}
                >
                  Despesas
                </Text>

                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "bold",
                    color: "#A14F3F",
                  }}
                >
                  {FormatarMoeda(TotalDespesas())}
                </Text>
              </View>

            </View>


            {/* BALANÇO */}

            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: "#D8DDD8",
                paddingTop: 16,
                alignItems: "center",
              }}
            >

              <Text
                style={{
                  fontSize: 14,
                  color: "#555",
                  marginBottom: 8,
                }}
              >
                Balanço Financeiro
              </Text>

              <Text
                style={{
                  fontSize: 26,
                  fontWeight: "bold",
                  color: corBalanco,
                }}
              >
                {FormatarMoeda(CalcularBalanco())}
              </Text>

            </View>

          </Janela>


          {/* ===================================
              GRÁFICO DE DESPESAS
          =================================== */}

          <Janela>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                textAlign: "center",
                color: "#252525",
                marginBottom: 8,
              }}
            >
              Controle de Despesas
            </Text>

            <Grafico
              titulo="Despesas"
              porcentagem={percentualDespesas}
              cor="#C76852"
            />

            {/* ALERTA CONDICIONAL DE DESPESAS */}

            {mensagemAlerta !== null && (

              <View
                style={{
                  backgroundColor: fundoAlerta,
                  borderLeftWidth: 4,
                  borderLeftColor: corAlerta,
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 8,
                }}
              >
                <Text
                  style={{
                    color: corAlerta,
                    fontSize: 14,
                    fontWeight: "bold",
                    lineHeight: 21,
                  }}
                >
                  {mensagemAlerta}
                </Text>
              </View>

            )}

          </Janela>


          {/* ===================================
              GRÁFICO DE RECEITAS
          =================================== */}

          <Janela>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                textAlign: "center",
                color: "#252525",
                marginBottom: 8,
              }}
            >
              Controle de Receitas
            </Text>

            <Grafico
              titulo="Receitas"
              porcentagem={PorcentagemReceitas()}
              cor="#698269"
            />

            <Text
              style={{
                color: "#444",
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              Definir Meta de Receitas (R$)
            </Text>

            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#D8DDD8",
                padding: 12,
                borderRadius: 8,
                fontSize: 16,
                color: "#222",
              }}
              value={metaReceitas}
              onChangeText={definirMetaReceitas}
              placeholder="Ex.: 1000,00"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              accessibilityLabel="Meta de receitas"
            />

            {!metaReceitasValida && (
              <Text
                style={{ color: "#B42318", marginTop: 8 }}
              >
                Informe uma meta de receitas maior que zero.
              </Text>
            )}

          </Janela>


          {/* ===================================
              META DE ECONOMIA
          =================================== */}

          <Janela>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                textAlign: "center",
                color: "#252525",
                marginBottom: 8,
              }}
            >
              Meta de Economia
            </Text>

            <Grafico
              titulo="Meta de Economia"
              porcentagem={PorcentagemEconomia()}
              cor="#4682B4"
            />

            <Text
              style={{
                color: "#444",
                marginTop: 16,
                marginBottom: 8,
              }}
            >
              Definir Meta de Economia (R$)
            </Text>

            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#D8DDD8",
                padding: 12,
                borderRadius: 8,
                fontSize: 16,
                color: "#222",
              }}
              value={metaEconomia}
              onChangeText={definirMetaEconomia}
              placeholder="Ex.: 500,00"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              accessibilityLabel="Meta de economia"
            />

            {!metaEconomiaValida && (
              <Text
                style={{ color: "#B42318", marginTop: 8 }}
              >
                Informe uma meta de economia maior que zero.
              </Text>
            )}

          </Janela>


          {/* ===================================
              DEFINIR LIMITE
          =================================== */}

          <Janela>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                textAlign: "center",
                color: "#252525",
                marginBottom: 16,
              }}
            >
              Definir Limite
            </Text>

            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#D8DDD8",
                padding: 12,
                borderRadius: 8,
                fontSize: 16,
                color: "#222",
              }}
              value={limite}
              onChangeText={definirLimite}
              placeholder="Limite (R$)"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              accessibilityLabel="Limite de despesas"
            />

            {!limiteValido && (
              <Text
                style={{
                  color: "#B42318",
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                Informe um limite maior que zero.
              </Text>
            )}

            <Text
              style={{
                marginTop: 12,
                color: "#555",
                fontSize: 14,
              }}
            >
              Limite atual:{" "}
              {limiteValido
                ? FormatarMoeda(limiteNumerico)
                : "Inválido"}
            </Text>

          </Janela>


          {/* ===================================
              ADICIONAR MOVIMENTAÇÃO
          =================================== */}

          <Janela>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                textAlign: "center",
                color: "#252525",
                marginBottom: 16,
              }}
            >
              Adicionar Movimentação
            </Text>


            {/* SELEÇÃO DO TIPO */}

            <Text
              style={{
                color: "#444",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              Tipo de movimentação
            </Text>

            <View
              style={{
                flexDirection: "row",
                marginBottom: 16,
              }}
            >

              <Pressable
                onPress={() => mudarTipo("despesa")}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: tipo === "despesa",
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 12,
                  marginRight: 8,
                  backgroundColor:
                    tipo === "despesa" ? "#C76852" : "#DDD",
                  borderRadius: 8,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: tipo === "despesa" ? "#fff" : "#333",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Despesa
                </Text>
              </Pressable>

              <Pressable
                onPress={() => mudarTipo("receita")}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: tipo === "receita",
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  padding: 12,
                  backgroundColor:
                    tipo === "receita" ? "#698269" : "#DDD",
                  borderRadius: 8,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: tipo === "receita" ? "#fff" : "#333",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Receita
                </Text>
              </Pressable>

            </View>


            {/* CATEGORIA */}

            <Text
              style={{
                color: "#444",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              Categoria
            </Text>

            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#D8DDD8",
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                fontSize: 16,
                color: "#222",
              }}
              value={categoria}
              onChangeText={mudarCategoria}
              placeholder={
                tipo === "despesa"
                  ? "Ex.: Alimentação"
                  : "Ex.: Mesada"
              }
              placeholderTextColor="#888"
              keyboardType="default"
              accessibilityLabel="Categoria da movimentação"
            />


            {/* VALOR */}

            <Text
              style={{
                color: "#444",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              Valor (R$)
            </Text>

            <TextInput
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#D8DDD8",
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                fontSize: 16,
                color: "#222",
              }}
              value={valor}
              onChangeText={mudarValor}
              placeholder="Ex.: 45,50"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
              accessibilityLabel="Valor da movimentação"
            />


            {/* BOTÃO DE CADASTRO */}

            <Pressable
              onPress={AdicionarMovimentacao}
              accessibilityRole="button"
              style={({ pressed }) => ({
                backgroundColor: "#698269",
                borderRadius: 8,
                paddingVertical: 16,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: "#fff",
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                {tipo === "despesa"
                  ? "Adicionar Despesa"
                  : "Adicionar Receita"}
              </Text>
            </Pressable>

          </Janela>


          {/* ===================================
              HISTÓRICO DE MOVIMENTAÇÕES
          =================================== */}

          <Janela>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                textAlign: "center",
                color: "#252525",
                marginBottom: 8,
              }}
            >
              Histórico de Movimentações
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: "#777",
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              {movimentacoes.length} registros
            </Text>


            {/* MENSAGEM DE HISTÓRICO VAZIO */}

            {movimentacoes.length === 0 && (
              <Text
                style={{
                  color: "#777",
                  textAlign: "center",
                  paddingVertical: 16,
                }}
              >
                Nenhuma movimentação cadastrada.
                Adicione uma receita ou despesa para começar.
              </Text>
            )}


            {/* LISTA DE MOVIMENTAÇÕES */}

            {[...movimentacoes].reverse().map(
              function (movimentacao) {

                const ehReceita =
                  movimentacao.tipo === "receita";

                const cor =
                  ehReceita ? "#698269" : "#C76852";

                const sinal = ehReceita ? "+" : "−";

                const estaEditando =
                  idEmEdicao === movimentacao.id;

                return (

                  <View
                    key={movimentacao.id}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                      borderLeftWidth: 4,
                      borderLeftColor: cor,
                    }}
                  >

                    {/* INFORMAÇÕES ORIGINAIS */}

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >

                      <View
                        style={{
                          flex: 1,
                          marginRight: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "bold",
                            color: "#252525",
                          }}
                        >
                          {movimentacao.categoria}
                        </Text>

                        <Text
                          style={{
                            fontSize: 13,
                            color: "#777",
                            marginTop: 4,
                          }}
                        >
                          {ehReceita ? "Receita" : "Despesa"}
                        </Text>
                      </View>

                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "bold",
                          color: cor,
                          flexShrink: 1,
                          textAlign: "right",
                        }}
                      >
                        {sinal} {FormatarMoeda(movimentacao.valor)}
                      </Text>

                    </View>


                    {/* ===================================
                        FORMULÁRIO DE EDIÇÃO
                    =================================== */}

                    {estaEditando ? (

                      <View
                        style={{
                          marginTop: 16,
                          borderTopWidth: 1,
                          borderTopColor: "#D8DDD8",
                          paddingTop: 12,
                        }}
                      >

                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "bold",
                            color: "#333",
                            marginBottom: 12,
                          }}
                        >
                          Editar Movimentação
                        </Text>


                        {/* ALTERAR TIPO */}

                        <Text
                          style={{
                            color: "#444",
                            marginBottom: 8,
                          }}
                        >
                          Tipo
                        </Text>

                        <View
                          style={{
                            flexDirection: "row",
                            marginBottom: 12,
                          }}
                        >

                          <Pressable
                            onPress={() => mudarTipoEdicao("despesa")}
                            accessibilityRole="radio"
                            accessibilityState={{
                              checked: tipoEdicao === "despesa",
                            }}
                            style={({ pressed }) => ({
                              flex: 1,
                              padding: 10,
                              marginRight: 8,
                              borderRadius: 8,
                              backgroundColor:
                                tipoEdicao === "despesa"
                                  ? "#C76852"
                                  : "#DDD",
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text
                              style={{
                                textAlign: "center",
                                fontWeight: "bold",
                                color:
                                  tipoEdicao === "despesa"
                                    ? "#fff"
                                    : "#333",
                              }}
                            >
                              Despesa
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => mudarTipoEdicao("receita")}
                            accessibilityRole="radio"
                            accessibilityState={{
                              checked: tipoEdicao === "receita",
                            }}
                            style={({ pressed }) => ({
                              flex: 1,
                              padding: 10,
                              borderRadius: 8,
                              backgroundColor:
                                tipoEdicao === "receita"
                                  ? "#698269"
                                  : "#DDD",
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text
                              style={{
                                textAlign: "center",
                                fontWeight: "bold",
                                color:
                                  tipoEdicao === "receita"
                                    ? "#fff"
                                    : "#333",
                              }}
                            >
                              Receita
                            </Text>
                          </Pressable>

                        </View>


                        {/* ALTERAR CATEGORIA */}

                        <Text
                          style={{
                            color: "#444",
                            marginBottom: 8,
                          }}
                        >
                          Categoria
                        </Text>

                        <TextInput
                          style={{
                            backgroundColor: "#fff",
                            borderWidth: 1,
                            borderColor: "#D8DDD8",
                            padding: 12,
                            borderRadius: 8,
                            fontSize: 16,
                            color: "#222",
                            marginBottom: 12,
                          }}
                          value={categoriaEdicao}
                          onChangeText={mudarCategoriaEdicao}
                          placeholder="Categoria"
                          placeholderTextColor="#888"
                          accessibilityLabel="Editar categoria"
                        />


                        {/* ALTERAR VALOR */}

                        <Text
                          style={{
                            color: "#444",
                            marginBottom: 8,
                          }}
                        >
                          Valor (R$)
                        </Text>

                        <TextInput
                          style={{
                            backgroundColor: "#fff",
                            borderWidth: 1,
                            borderColor: "#D8DDD8",
                            padding: 12,
                            borderRadius: 8,
                            fontSize: 16,
                            color: "#222",
                            marginBottom: 16,
                          }}
                          value={valorEdicao}
                          onChangeText={mudarValorEdicao}
                          placeholder="Ex.: 50,00"
                          placeholderTextColor="#888"
                          keyboardType="decimal-pad"
                          accessibilityLabel="Editar valor"
                        />


                        {/* SALVAR OU CANCELAR */}

                        <View
                          style={{
                            flexDirection: "row",
                          }}
                        >

                          <Pressable
                            onPress={SalvarEdicao}
                            accessibilityRole="button"
                            style={({ pressed }) => ({
                              flex: 1,
                              padding: 12,
                              borderRadius: 8,
                              marginRight: 8,
                              backgroundColor: "#698269",
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontWeight: "bold",
                                textAlign: "center",
                              }}
                            >
                              Salvar
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={CancelarEdicao}
                            accessibilityRole="button"
                            style={({ pressed }) => ({
                              flex: 1,
                              padding: 12,
                              borderRadius: 8,
                              backgroundColor: "#777",
                              opacity: pressed ? 0.7 : 1,
                            })}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontWeight: "bold",
                                textAlign: "center",
                              }}
                            >
                              Cancelar
                            </Text>
                          </Pressable>

                        </View>

                      </View>

                    ) : (

                      // ===================================
                      // BOTÕES EDITAR E EXCLUIR
                      // ===================================

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "flex-end",
                          marginTop: 12,
                          borderTopWidth: 1,
                          borderTopColor: "#EEE",
                          paddingTop: 12,
                        }}
                      >

                        <Pressable
                          onPress={() => IniciarEdicao(movimentacao)}
                          accessibilityRole="button"
                          style={({ pressed }) => ({
                            backgroundColor: "#E3F0E5",
                            paddingVertical: 9,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            marginRight: 8,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Text
                            style={{
                              color: "#456B4A",
                              fontWeight: "bold",
                            }}
                          >
                            Editar
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => ExcluirMovimentacao(movimentacao)}
                          accessibilityRole="button"
                          style={({ pressed }) => ({
                            backgroundColor: "#F8E5E1",
                            paddingVertical: 9,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Text
                            style={{
                              color: "#A14F3F",
                              fontWeight: "bold",
                            }}
                          >
                            Excluir
                          </Text>
                        </Pressable>

                      </View>

                    )}

                  </View>

                );
              }
            )}


            {/* ===================================
                NOVO: BOTÃO EXPORTAR HISTÓRICO
            =================================== */}

            <Pressable
              onPress={ExportarHistorico}
              disabled={exportando || movimentacoes.length === 0}
              accessibilityRole="button"
              accessibilityLabel="Exportar histórico em CSV"
              style={({ pressed }) => ({
                backgroundColor: "#4682B4",
                borderRadius: 8,
                paddingVertical: 16,
                marginTop: 16,
                opacity:
                  exportando || movimentacoes.length === 0
                    ? 0.5
                    : pressed ? 0.7 : 1,
              })}
            >

              <Text
                style={{
                  color: "#fff",
                  textAlign: "center",
                  fontSize: 16,
                  fontWeight: "bold",
                }}
              >
                {exportando
                  ? "Preparando arquivo..."
                  : "Exportar Histórico (CSV)"}
              </Text>

            </Pressable>

            <Text
              style={{
                color: "#777",
                fontSize: 12,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Exporte suas receitas e despesas para uma planilha.
            </Text>

          </Janela>

        </ScrollView>

      </SafeAreaView>

    </SafeAreaProvider>
  );
}
