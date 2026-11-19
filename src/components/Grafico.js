
import React from "react";
import { View, Text } from "react-native";

import Estilo from "../styles/StylesGrafico.js";

export default function Grafico(props) {

  // Converte a porcentagem recebida em número.
  const porcentagem = Number(props.porcentagem);

  // Verifica se a porcentagem é válida.
  const porcentagemValida = Number.isFinite(porcentagem)
    ? porcentagem
    : 0;

  // Mantém a largura da barra entre 0% e 100%.
  const largura = Math.min(
    100,
    Math.max(0, porcentagemValida)
  );

  // Decide se o texto cabe dentro da barra.
  const textoDentro = largura >= 20;

  // Apresenta o percentual com até uma casa decimal.
  const percentualTexto =
    Number(porcentagemValida.toFixed(1)) + "%";

  return (
    <View style={Estilo.grafico}>

      <Text style={Estilo.graficoTitulo}>
        {props.titulo}
      </Text>

      <View>

        <View
          style={[
            Estilo.graficoBarra,
            {
              width: `${largura}%`,
              backgroundColor: props.cor || "#698269",
            },
          ]}
        >
          {textoDentro && (
            <Text style={Estilo.graficoTexto}>
              {percentualTexto}
            </Text>
          )}
        </View>

        {!textoDentro && (
          <Text style={Estilo.graficoTextoExterno}>
            {percentualTexto}
          </Text>
        )}

      </View>

    </View>
  );
}
