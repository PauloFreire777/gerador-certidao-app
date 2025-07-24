<template>
  <div class="dynamic-card" :class="{ 'sub-card': isRepresentative }">
    <h4 class="card-title">{{ isRepresentative ? 'Representante' : 'Herdeiro(a)' }} {{ index + 1 }}</h4>
    <button @click="removeThis" class="btn-remove" :title="isRepresentative ? 'Remover Representante' : 'Remover Herdeiro'">×</button>
    
    <div class="form-group checkbox-group" v-if="!isRepresentative">
        <input type="checkbox" :id="'meeiro_' + heir.id" v-model="heir.isMeeiro">
        <label :for="'meeiro_' + heir.id">Este herdeiro é Meeiro(a)</label>
    </div>

    <div class="form-group">
        <label>Nome Completo <span class="required">*</span></label>
        <input type="text" v-model="heir.nome">
    </div>
    <div class="grid-3">
        <div class="form-group">
            <label>Parentesco <span class="required">*</span></label>
            <input type="text" v-model="heir.parentesco">
        </div>
        <div class="form-group">
            <label>Estado <span class="required">*</span></label>
            <select v-model="heir.estado">
                <option>Capaz</option>
                <option>Incapaz</option>
                <option>Falecido</option>
            </select>
        </div>
        <div class="form-group">
            <label>Estado Civil <span class="required">*</span></label>
            <select v-model="heir.estadoCivil">
                <option>Solteiro(a)</option>
                <option>Casado(a)</option>
                <option>União Estável</option>
                <option>Divorciado(a)</option>
                <option>Viúvo(a)</option>
            </select>
        </div>
    </div>
    <div class="form-group">
        <label>Documentos Pessoais (CPF/RG) <span class="required">*</span></label>
        <input type="text" v-model="heir.documentos">
    </div>

    <div v-if="heir.estado === 'Capaz'" class="conditional-section">
        <div class="form-group">
            <label>ID da Procuração</label>
            <input type="text" v-model="heir.idProcuracao">
        </div>
        <div class="form-group" v-if="advogados.length > 0">
            <label>Advogado Representante</label>
            <select v-model="heir.advogadoId">
                <option value="">Selecione um advogado</option>
                <option v-for="adv in advogados" :key="adv.id" :value="adv.id">
                    {{ adv.nome }} - OAB: {{ adv.oab }}
                </option>
            </select>
        </div>
    </div>
    <div v-if="heir.estado === 'Incapaz'" class="conditional-section warning">
        <label class="bold">Dados da Curatela (representação do incapaz)</label>
        <div class="grid-2">
            <div class="form-group">
                <label>Nome do Curador <span class="required">*</span></label>
                <input type="text" v-model="heir.curador.nome">
            </div>
            <div class="form-group">
                <label>ID Termo de Compromisso <span class="required">*</span></label>
                <input type="text" v-model="heir.curador.idTermo">
            </div>
        </div>
        <div class="form-group">
            <label>ID da Procuração do Curador</label>
            <input type="text" v-model="heir.curador.idProcuracao">
        </div>
        <div class="form-group" v-if="advogados.length > 0">
            <label>Advogado que representa o Curatelado</label>
            <select v-model="heir.curador.advogadoId">
                <option value="">Selecione um advogado</option>
                <option v-for="adv in advogados" :key="adv.id" :value="adv.id">
                    {{ adv.nome }} - OAB: {{ adv.oab }}
                </option>
            </select>
        </div>
    </div>
    <div v-if="heir.estado === 'Falecido'" class="conditional-section danger">
        <div class="form-group">
            <label>ID da Certidão de Óbito <span class="required">*</span></label>
            <input type="text" v-model="heir.idCertidaoObito">
        </div>
        <fieldset>
            <legend>Representantes de {{ heir.nome || 'Herdeiro Falecido' }}</legend>
            <HeirFormComponent
                v-for="(rep, rIndex) in heir.representantes"
                :key="rep.id"
                :heir="rep"
                :index="rIndex"
                :is-representative="true"
                :level="level + 1"
                :advogados="advogados"
                @remove="removeRepresentante(rIndex)">
            </HeirFormComponent>
            <button @click="addRepresentante" class="btn-add-small"><i data-lucide="plus"></i> Adicionar Representante</button>
        </fieldset>
    </div>
    <div v-if="heir.estadoCivil === 'Casado(a)' || heir.estadoCivil === 'União Estável'" class="conditional-section">
        <label class="bold">Dados do Cônjuge/Companheiro(a)</label>
        <div class="grid-2">
            <div class="form-group">
                <label>Nome do Cônjuge <span class="required">*</span></label>
                <input type="text" v-model="heir.conjuge.nome">
            </div>
            <div class="form-group">
                <label>ID da Procuração do Cônjuge</label>
                <input type="text" v-model="heir.conjuge.idProcuracao">
            </div>
        </div>
        <div class="grid-2">
            <div class="form-group">
                <label>Regime de Bens</label>
                <select v-model="heir.conjuge.regimeDeBens">
                    <option>Comunhão Parcial de Bens</option>
                    <option>Comunhão Universal de Bens</option>
                    <option>Separação Total de Bens</option>
                    <option>Participação Final nos Aquestos</option>
                </select>
            </div>
            <div class="form-group" v-if="advogados.length > 0">
                <label>Advogado do Cônjuge</label>
                <select v-model="heir.conjuge.advogadoId">
                    <option value="">Selecione um advogado</option>
                    <option v-for="adv in advogados" :key="adv.id" :value="adv.id">
                        {{ adv.nome }} - OAB: {{ adv.oab }}
                    </option>
                </select>
            </div>
        </div>
    </div>
  </div>
</template>

<script>
import { createHeirObject } from '../utils/stateHelpers.js';
export default {
    name: 'HeirFormComponent',
    props: {
        heir: Object,
        index: Number,
        isRepresentative: Boolean,
        level: {
            type: Number,
            default: 0
        },
        advogados: {
            type: Array,
            default: () => []
        }
    },
    emits: ['remove'],
    methods: {
        addRepresentante() {
            this.heir.representantes.push(createHeirObject());
        },
        removeThis() {
            this.$emit('remove', this.index);
        },
        removeRepresentante(repIndex) {
            this.heir.representantes.splice(repIndex, 1);
        }
    }
}
</script>

<style scoped>
/* Estilos específicos para este componente podem vir aqui, se necessário */
</style>