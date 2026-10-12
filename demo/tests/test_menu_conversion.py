import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('converter',Path(__file__).parents[1]/'tools/convert_globalfood.py')
converter=importlib.util.module_from_spec(spec);spec.loader.exec_module(converter)
class MenuConversionTest(unittest.TestCase):
 def test_numeric_prices_size_extras_and_unicode(self):
  extra={'id':1,'name':'Pommes','options':[{'id':2,'name':'Ja','price':35}]}
  source={'categories':[{'id':1,'name':'PIZZA','items':[{'id':4,'name':'Test','price':189,'description':'Medium 175kr | Stor 275kr ➔ Ost','sizes':[{'id':5,'name':'𝗠𝗲𝗱𝗶𝘂𝗺','price':0,'groups':[extra]},{'id':6,'name':'𝗦𝗧𝗢𝗥 𝗣𝗜𝗭𝗭𝗔','price':105,'default':True,'groups':[{'id':9,'name':'Lojalitetsprogram!','options':[]}]}]}]}]}
  menu=converter.convert(source);item=menu['sections'][0]['items'][0]
  self.assertEqual([size['price']for size in item['sizes']],[189,294])
  self.assertEqual([size['label']for size in item['sizes']],['Medium','Stor'])
  self.assertEqual(item['defaultSizeIndex'],1)
  self.assertEqual(item['description'],'Ost')
  self.assertEqual(item['sizes'][0]['optionGroupIds'],['gf_group_1'])
  self.assertEqual(item['sizes'][1]['optionGroupIds'],[])
  self.assertNotIn('settings',menu)
if __name__=='__main__':unittest.main()
