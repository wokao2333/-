import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import KvVue from './index.vue';

describe('KvVue', () => {
  it('keeps the unit column fixed when the value changes', async () => {
    const wrapper = mount(KvVue, {
      props: {
        label: 'Ua',
        labelWidth: 30,
        value: '1',
        valueWidth: 72,
        unit: 'V',
        unitWidth: 20,
        unitGap: 12
      }
    });
    const getColumnWidths = () =>
      wrapper.findAll('col').map((column) => column.attributes('style'));

    expect(wrapper.find('table').attributes('style')).toContain('width: 134px');
    expect(getColumnWidths()).toEqual(['width: 30px;', 'width: 72px;', 'width: 32px;']);

    await wrapper.setProps({ value: '233.8' });

    expect(wrapper.find('table').attributes('style')).toContain('width: 134px');
    expect(getColumnWidths()).toEqual(['width: 30px;', 'width: 72px;', 'width: 32px;']);
  });
});
